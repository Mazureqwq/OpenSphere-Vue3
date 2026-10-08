import { inject, type InjectionKey, type Ref } from 'vue';
import type {
  DemoRole,
  DemoUser,
  Incident,
  IncidentCategory,
  IncidentTimelineEntry,
  ImportBatch,
} from '../domain/types.ts';
import type { IncidentImportFieldMapping, IncidentImportSource } from '../application/incidentImport.ts';
import type { IncidentImportResult } from '../application/incidentService.ts';

export interface IncidentWorkspaceContext {
  ready: Ref<boolean>;
  error: Ref<string | undefined>;
  currentRole: Ref<DemoRole>;
  incidents: Ref<Incident[]>;
  users: Ref<DemoUser[]>;
  categories: Ref<IncidentCategory[]>;
  importBatches: Ref<ImportBatch[]>;
  selectedIncidentId: Ref<string | undefined>;
  selectedIncident: Ref<Incident | undefined>;
  hydrate: () => Promise<void>;
  refresh: () => Promise<void>;
  syncMapProjection: () => void;
  setRole: (role: DemoRole) => void;
  selectIncident: (incidentId?: string) => void;
  focusIncident: (incidentId: string) => void;
  create: (draft: Parameters<import('../application/incidentService.ts').IncidentService['create']>[0]) => Promise<Incident>;
  importText: (source: IncidentImportSource, mapping?: IncidentImportFieldMapping) => Promise<IncidentImportResult>;
  assign: (incidentId: string, assignedTo: string) => Promise<Incident>;
  start: (incidentId: string) => Promise<Incident>;
  update: (incidentId: string, note: string) => Promise<Incident>;
  submitForReview: (incidentId: string, note: string) => Promise<Incident>;
  approve: (incidentId: string, note?: string) => Promise<Incident>;
  returnForRework: (incidentId: string, reason: string) => Promise<Incident>;
  cancel: (incidentId: string, reason: string) => Promise<Incident>;
  revokeImportBatch: (batchId: string) => Promise<void>;
  getTimeline: (incidentId: string) => Promise<IncidentTimelineEntry[]>;
  resetDemoData: () => Promise<void>;
}

export const incidentContextKey: InjectionKey<IncidentWorkspaceContext> = Symbol('incident-workspace');

export function useIncidentWorkspaceContext(): IncidentWorkspaceContext {
  const context = inject(incidentContextKey);
  if (!context) throw new Error('事件工作区尚未提供');
  return context;
}
