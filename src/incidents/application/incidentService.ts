import { transitionIncident } from '../domain/incidentMachine.ts';
import { validateIncidentDraft } from '../domain/importValidation.ts';
import { canIncidentAction } from '../domain/permissions.ts';
import {
  DEFAULT_LOCAL_PROJECT_ID,
  INCIDENT_SCHEMA_VERSION,
  type DemoUser,
  type Incident,
  type IncidentAction,
  type IncidentDraft,
  type IncidentTimelineEntry,
  type ImportBatch,
  type NormalizedIncidentDraft,
} from '../domain/types.ts';
import type { IncidentWorkspaceRepository } from '../repositories/contracts.ts';
import type { IncidentImportError, IncidentImportFieldMapping, IncidentImportSource } from './incidentImport.ts';
import { parseIncidentImport } from './incidentImport.ts';
import type { IncidentDemoSeed } from '../repositories/contracts.ts';

export interface IncidentServiceOptions {
  projectId?: string;
  now?: () => string;
  idFactory?: (prefix: string) => string;
}

export interface IncidentImportResult {
  batch: ImportBatch;
  incidents: Incident[];
  errors: IncidentImportError[];
}

function defaultIdFactory(prefix: string): string {
  const suffix = globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  return `${prefix}-${suffix}`;
}

function errorForValidation(errors: Record<string, string | undefined>): Error {
  return new Error(`事件数据无效：${Object.values(errors).filter(Boolean).join('；')}`);
}

function cleanMapping(mapping: IncidentImportFieldMapping): Record<string, string> {
  return Object.fromEntries(Object.entries(mapping).filter((entry): entry is [string, string] => Boolean(entry[1])));
}

export class IncidentService {
  private readonly repository: IncidentWorkspaceRepository;
  private readonly projectId: string;
  private readonly now: () => string;
  private readonly idFactory: (prefix: string) => string;

  constructor(repository: IncidentWorkspaceRepository, options: IncidentServiceOptions = {}) {
    this.repository = repository;
    this.projectId = options.projectId ?? DEFAULT_LOCAL_PROJECT_ID;
    this.now = options.now ?? (() => new Date().toISOString());
    this.idFactory = options.idFactory ?? defaultIdFactory;
  }

  async initialize(seed: IncidentDemoSeed): Promise<void> {
    await this.repository.initialize(seed);
  }

  async listIncidents(): Promise<Incident[]> {
    return this.repository.listIncidents(this.projectId);
  }

  async create(draft: IncidentDraft, actor: DemoUser): Promise<Incident> {
    this.assertPermission(actor, 'create');
    const normalized = this.normalizeDraft(draft);
    return this.persistNewIncident(normalized, actor, 'created');
  }

  async assign(incidentId: string, assignedTo: string, actor: DemoUser): Promise<Incident> {
    return this.applyTransition(incidentId, 'assign', actor, { assignedTo });
  }

  async start(incidentId: string, actor: DemoUser): Promise<Incident> {
    return this.applyTransition(incidentId, 'start', actor);
  }

  async update(incidentId: string, note: string, actor: DemoUser): Promise<Incident> {
    return this.applyTransition(incidentId, 'update', actor, { note });
  }

  async submitForReview(incidentId: string, note: string, actor: DemoUser): Promise<Incident> {
    return this.applyTransition(incidentId, 'submit_review', actor, { note });
  }

  async approve(incidentId: string, note: string | undefined, actor: DemoUser): Promise<Incident> {
    return this.applyTransition(incidentId, 'approve', actor, { note });
  }

  async returnForRework(incidentId: string, reason: string, actor: DemoUser): Promise<Incident> {
    return this.applyTransition(incidentId, 'return', actor, { reason });
  }

  async cancel(incidentId: string, reason: string, actor: DemoUser): Promise<Incident> {
    return this.applyTransition(incidentId, 'cancel', actor, { reason });
  }

  async importText(source: IncidentImportSource, actor: DemoUser, mapping?: IncidentImportFieldMapping): Promise<IncidentImportResult> {
    this.assertPermission(actor, 'import');
    const parsed = parseIncidentImport(source, mapping);
    const batchId = this.idFactory('batch');
    const errors = [...parsed.errors];
    const incidents: Incident[] = [];

    for (const row of parsed.rows) {
      const validation = validateIncidentDraft(row.draft);
      if (!validation.valid || !validation.normalized) {
        errors.push({ row: row.row, raw: row.raw, message: Object.values(validation.errors).filter(Boolean).join('；') });
        continue;
      }
      incidents.push(await this.persistNewIncident(validation.normalized, actor, 'imported', batchId));
    }

    const batch: ImportBatch = {
      id: batchId,
      schemaVersion: INCIDENT_SCHEMA_VERSION,
      projectId: this.projectId,
      fileName: source.fileName,
      format: parsed.format,
      fieldMapping: cleanMapping(parsed.suggestedMapping),
      totalCount: parsed.rows.length + parsed.errors.length,
      successCount: incidents.length,
      failureCount: errors.length,
      errors,
      importedAt: this.now(),
      importedBy: actor.id,
    };
    await this.repository.saveImportBatch(batch);
    return { batch, incidents, errors };
  }

  async revokeImportBatch(batchId: string, actor: DemoUser): Promise<void> {
    this.assertPermission(actor, 'revoke_import_batch');
    const batch = await this.repository.getImportBatch(batchId);
    if (!batch) throw new Error('导入批次不存在');
    if (batch.revokedAt) throw new Error('导入批次已撤销');
    const imported = (await this.repository.listIncidents(batch.projectId)).filter((incident) => incident.sourceBatchId === batchId);
    if (imported.some((incident) => incident.status !== 'unassigned')) {
      throw new Error('仅当批次内全部事件仍待分派时才可撤销导入批次');
    }
    await this.repository.deleteIncidentsWithTimeline(imported.map((incident) => incident.id));
    await this.repository.saveImportBatch({ ...batch, revokedAt: this.now() });
  }

  private assertPermission(actor: DemoUser, action: IncidentAction): void {
    if (!canIncidentAction(actor.role, action)) throw new Error(`无权限执行动作 ${action}`);
  }

  private normalizeDraft(draft: IncidentDraft): NormalizedIncidentDraft {
    const validation = validateIncidentDraft(draft);
    if (!validation.valid || !validation.normalized) throw errorForValidation(validation.errors);
    return validation.normalized;
  }

  private async persistNewIncident(
    draft: NormalizedIncidentDraft,
    actor: DemoUser,
    timelineAction: 'created' | 'imported',
    sourceBatchId?: string,
  ): Promise<Incident> {
    const at = this.now();
    const id = this.idFactory('incident');
    const incident: Incident = {
      id,
      schemaVersion: INCIDENT_SCHEMA_VERSION,
      projectId: this.projectId,
      code: `INC-${id.replace(/^incident-/, '').toUpperCase()}`,
      title: draft.title,
      categoryId: draft.categoryId,
      severity: draft.severity,
      status: 'unassigned',
      geometry: draft.geometry,
      createdBy: actor.id,
      createdAt: at,
      updatedAt: at,
      version: 1,
      ...(sourceBatchId ? { sourceBatchId } : {}),
      ...(draft.description ? { description: draft.description } : {}),
    };
    const timeline: IncidentTimelineEntry = {
      id: `${id}:1:${timelineAction}`,
      schemaVersion: INCIDENT_SCHEMA_VERSION,
      projectId: this.projectId,
      incidentId: id,
      action: timelineAction,
      actorId: actor.id,
      at,
      toStatus: 'unassigned',
    };
    await this.repository.saveIncidentWithTimeline(incident, timeline);
    return incident;
  }

  private async applyTransition(
    incidentId: string,
    action: IncidentAction,
    actor: DemoUser,
    input: { assignedTo?: string; note?: string; reason?: string } = {},
  ): Promise<Incident> {
    const incident = await this.repository.getIncident(incidentId);
    if (!incident) throw new Error('事件不存在');
    const result = transitionIncident(incident, action, actor, { ...input, at: this.now() });
    await this.repository.saveIncidentWithTimeline(result.incident, result.timeline);
    return result.incident;
  }
}
