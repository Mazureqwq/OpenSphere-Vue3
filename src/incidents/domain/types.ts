export const DEFAULT_LOCAL_PROJECT_ID = 'local-demo' as const;
export const INCIDENT_SCHEMA_VERSION = 1 as const;

export const incidentStatuses = [
  'unassigned',
  'assigned',
  'in_progress',
  'pending_review',
  'closed',
  'cancelled',
] as const;
export type IncidentStatus = (typeof incidentStatuses)[number];

export const incidentSeverities = ['low', 'medium', 'high', 'critical'] as const;
export type IncidentSeverity = (typeof incidentSeverities)[number];

export const demoRoles = ['admin', 'dispatcher', 'supervisor'] as const;
export type DemoRole = (typeof demoRoles)[number];

export const incidentActions = [
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
] as const;
export type IncidentAction = (typeof incidentActions)[number];

export type IncidentGeometry = GeoJSON.Geometry;

export interface Incident {
  id: string;
  schemaVersion: typeof INCIDENT_SCHEMA_VERSION;
  projectId: string;
  code: string;
  title: string;
  categoryId: string;
  severity: IncidentSeverity;
  status: IncidentStatus;
  geometry: IncidentGeometry;
  createdBy: string;
  assignedTo?: string;
  createdAt: string;
  updatedAt: string;
  version: number;
  sourceBatchId?: string;
  description?: string;
}

export interface DemoUser {
  id: string;
  name: string;
  role: DemoRole;
  schemaVersion?: typeof INCIDENT_SCHEMA_VERSION;
}

export interface IncidentTimelineEntry {
  id: string;
  schemaVersion: typeof INCIDENT_SCHEMA_VERSION;
  projectId: string;
  incidentId: string;
  action: IncidentAction | 'created' | 'imported';
  actorId: string;
  at: string;
  fromStatus?: IncidentStatus;
  toStatus?: IncidentStatus;
  note?: string;
  reason?: string;
  assignedTo?: string;
}

export interface IncidentCategory {
  id: string;
  schemaVersion: typeof INCIDENT_SCHEMA_VERSION;
  name: string;
  defaultSeverity: IncidentSeverity;
  active: boolean;
}

export interface ImportBatchError {
  row: number;
  message: string;
  raw?: Record<string, unknown>;
}

export interface ImportBatch {
  id: string;
  schemaVersion: typeof INCIDENT_SCHEMA_VERSION;
  projectId: string;
  fileName: string;
  format: 'csv' | 'geojson';
  fieldMapping?: Record<string, string>;
  totalCount: number;
  successCount: number;
  failureCount: number;
  errors: ImportBatchError[];
  importedAt: string;
  importedBy: string;
  revokedAt?: string;
}

export interface IncidentWorkspaceSnapshot {
  schemaVersion: typeof INCIDENT_SCHEMA_VERSION;
  projectId: string;
  selectedIncidentId?: string;
  statusFilter?: IncidentStatus[];
  severityFilter?: IncidentSeverity[];
  updatedAt: string;
}

export interface IncidentDraft {
  title?: unknown;
  categoryId?: unknown;
  severity?: unknown;
  geometry?: unknown;
  description?: unknown;
}

export interface NormalizedIncidentDraft {
  title: string;
  categoryId: string;
  severity: IncidentSeverity;
  geometry: IncidentGeometry;
  description?: string;
}

export interface IncidentDraftValidationResult {
  valid: boolean;
  errors: Partial<Record<'title' | 'categoryId' | 'severity' | 'geometry', string>>;
  normalized?: NormalizedIncidentDraft;
}

export interface IncidentTransitionInput {
  assignedTo?: string;
  note?: string;
  reason?: string;
  at?: string;
}

export interface IncidentTransitionResult {
  incident: Incident;
  timeline: IncidentTimelineEntry;
}
