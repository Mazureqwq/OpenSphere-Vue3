import type {
  DemoUser,
  Incident,
  IncidentCategory,
  IncidentDraft,
  IncidentTimelineEntry,
  ImportBatch,
} from '../domain/types.ts';

export const incidentApiEventNames = [
  'incident.created',
  'incident.updated',
  'incident.assignment.changed',
  'incident.reviewed',
  'import.completed',
] as const;
export type IncidentApiEventName = (typeof incidentApiEventNames)[number];

export interface ApiVersionedResponse<T> {
  data: T;
  version: number;
}

export interface ApiMeResponse {
  user: DemoUser;
  capabilities: string[];
}

export interface ApiProject {
  id: string;
  name: string;
}

export interface ApiIncidentListQuery {
  projectId: string;
  status?: Incident['status'][];
  assignedTo?: string;
}

export interface ApiCreateIncidentRequest {
  projectId: string;
  draft: IncidentDraft;
}

export interface ApiPatchIncidentRequest {
  title?: string;
  categoryId?: string;
  severity?: Incident['severity'];
  description?: string;
  version: number;
}

export interface ApiAssignmentRequest {
  assignedTo: string;
  version: number;
}

export interface ApiReviewRequest {
  action: 'approve' | 'return' | 'cancel';
  reason?: string;
  version: number;
}

export interface ApiImportBatchRequest {
  projectId: string;
  fileName: string;
  format: ImportBatch['format'];
}

export interface IncidentApiEvent<T = Incident | ImportBatch> {
  name: IncidentApiEventName;
  projectId: string;
  occurredAt: string;
  payload: T;
}

export interface ApiIncidentDetail {
  incident: Incident;
  timeline: IncidentTimelineEntry[];
}

export interface ApiReferenceData {
  users: DemoUser[];
  categories: IncidentCategory[];
}
