import type { DemoRole, Incident, IncidentAction } from './types.ts';

const roleActions: Record<DemoRole, readonly IncidentAction[]> = {
  admin: [
    'view',
    'create',
    'import',
    'assign',
    'start',
    'update',
    'submit_review',
    'approve',
    'return',
    'cancel',
    'manage_members',
    'manage_categories',
    'export_summary',
    'revoke_import_batch',
  ],
  dispatcher: [
    'view',
    'create',
    'import',
    'assign',
    'start',
    'update',
    'submit_review',
    'cancel',
    'export_summary',
    'revoke_import_batch',
  ],
  supervisor: ['view', 'approve', 'return', 'cancel', 'export_summary'],
};

const stateAllowsAction: Partial<Record<IncidentAction, readonly Incident['status'][]>> = {
  assign: ['unassigned', 'assigned'],
  start: ['assigned'],
  update: ['in_progress'],
  submit_review: ['in_progress'],
  approve: ['pending_review'],
  return: ['pending_review'],
};

export function canIncidentAction(role: DemoRole, action: IncidentAction, incident?: Incident): boolean {
  if (!roleActions[role].includes(action)) return false;
  if (!incident) return true;
  if (action === 'cancel') return incident.status !== 'closed' && incident.status !== 'cancelled';
  const allowedStates = stateAllowsAction[action];
  return !allowedStates || allowedStates.includes(incident.status);
}

export function getAllowedIncidentActions(role: DemoRole, incident?: Incident): IncidentAction[] {
  return roleActions[role].filter((action) => canIncidentAction(role, action, incident));
}
