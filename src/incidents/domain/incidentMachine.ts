import { canIncidentAction } from './permissions.ts';
import type {
  DemoUser,
  Incident,
  IncidentAction,
  IncidentStatus,
  IncidentTimelineEntry,
  IncidentTransitionInput,
  IncidentTransitionResult,
} from './types.ts';
import { INCIDENT_SCHEMA_VERSION } from './types.ts';

const actionTargets: Partial<Record<IncidentAction, IncidentStatus>> = {
  assign: 'assigned',
  start: 'in_progress',
  update: 'in_progress',
  submit_review: 'pending_review',
  approve: 'closed',
  return: 'in_progress',
  cancel: 'cancelled',
};

function invalidTransition(incident: Incident, action: IncidentAction): never {
  throw new Error(`不允许从 ${incident.status} 执行动作 ${action}`);
}

function required(value: string | undefined, name: string): string {
  const normalized = value?.trim();
  if (!normalized) throw new Error(`${name}为必填项`);
  return normalized;
}

function transitionTime(input: IncidentTransitionInput): string {
  const at = input.at ?? new Date().toISOString();
  if (Number.isNaN(Date.parse(at))) throw new Error('操作时间无效');
  return at;
}

function createTimelineEntry(
  incident: Incident,
  action: IncidentAction,
  actor: DemoUser,
  input: IncidentTransitionInput,
  toStatus: IncidentStatus,
  at: string,
): IncidentTimelineEntry {
  return {
    id: `${incident.id}:${incident.version + 1}:${action}`,
    schemaVersion: INCIDENT_SCHEMA_VERSION,
    projectId: incident.projectId,
    incidentId: incident.id,
    action,
    actorId: actor.id,
    at,
    fromStatus: incident.status,
    toStatus,
    ...(input.note?.trim() ? { note: input.note.trim() } : {}),
    ...(input.reason?.trim() ? { reason: input.reason.trim() } : {}),
    ...(input.assignedTo?.trim() ? { assignedTo: input.assignedTo.trim() } : {}),
  };
}

export function transitionIncident(
  incident: Incident,
  action: IncidentAction,
  actor: DemoUser,
  input: IncidentTransitionInput = {},
): IncidentTransitionResult {
  const targetStatus = actionTargets[action];
  if (!targetStatus) throw new Error(`不允许使用状态机执行动作 ${action}`);
  if (!canIncidentAction(actor.role, action)) {
    throw new Error(`无权限执行动作 ${action}`);
  }
  if (!canIncidentAction(actor.role, action, incident)) {
    invalidTransition(incident, action);
  }

  if (action === 'assign') required(input.assignedTo, '处置对象');
  if (action === 'return' || action === 'cancel') required(input.reason, '原因');
  if (action === 'update') required(input.note, '处置说明');

  const at = transitionTime(input);
  const nextStatus = action === 'assign' && incident.status === 'assigned' ? 'assigned' : targetStatus;
  if (action !== 'cancel' && action !== 'assign' && incident.status === 'cancelled') invalidTransition(incident, action);

  const nextIncident: Incident = {
    ...incident,
    status: nextStatus,
    ...(action === 'assign' ? { assignedTo: required(input.assignedTo, '处置对象') } : {}),
    updatedAt: at,
    version: incident.version + 1,
  };

  return {
    incident: nextIncident,
    timeline: createTimelineEntry(incident, action, actor, input, nextStatus, at),
  };
}
