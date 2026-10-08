import {
  DEFAULT_LOCAL_PROJECT_ID,
  INCIDENT_SCHEMA_VERSION,
  type DemoUser,
  type Incident,
  type IncidentCategory,
  type IncidentTimelineEntry,
} from '../domain/types.ts';
import type { IncidentDemoSeed } from '../repositories/contracts.ts';

const seedTime = '2026-10-07T08:00:00.000Z';

const users: DemoUser[] = [
  { id: 'demo-admin', name: '管理员', role: 'admin', schemaVersion: INCIDENT_SCHEMA_VERSION },
  { id: 'demo-dispatcher', name: '调度员', role: 'dispatcher', schemaVersion: INCIDENT_SCHEMA_VERSION },
  { id: 'demo-supervisor', name: '主管', role: 'supervisor', schemaVersion: INCIDENT_SCHEMA_VERSION },
];

const categories: IncidentCategory[] = [
  { id: 'weather', schemaVersion: INCIDENT_SCHEMA_VERSION, name: '天气灾害', defaultSeverity: 'high', active: true },
  { id: 'infrastructure', schemaVersion: INCIDENT_SCHEMA_VERSION, name: '市政设施', defaultSeverity: 'medium', active: true },
  { id: 'safety', schemaVersion: INCIDENT_SCHEMA_VERSION, name: '公共安全', defaultSeverity: 'critical', active: true },
  { id: 'other', schemaVersion: INCIDENT_SCHEMA_VERSION, name: '其他', defaultSeverity: 'medium', active: true },
];

const incidents: Incident[] = [
  {
    id: 'demo-incident-001',
    schemaVersion: INCIDENT_SCHEMA_VERSION,
    projectId: DEFAULT_LOCAL_PROJECT_ID,
    code: 'INC-DEMO-001',
    title: '示例：道路积水',
    categoryId: 'weather',
    severity: 'high',
    status: 'unassigned',
    geometry: { type: 'Point', coordinates: [139.767, 35.681] },
    createdBy: 'demo-admin',
    createdAt: seedTime,
    updatedAt: seedTime,
    version: 1,
    description: '用于演示本地事件工作流的初始事件。',
  },
];

const timeline: IncidentTimelineEntry[] = [
  {
    id: 'demo-incident-001:1:created',
    schemaVersion: INCIDENT_SCHEMA_VERSION,
    projectId: DEFAULT_LOCAL_PROJECT_ID,
    incidentId: 'demo-incident-001',
    action: 'created',
    actorId: 'demo-admin',
    at: seedTime,
    toStatus: 'unassigned',
  },
];

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

export function createDemoIncidentSeed(): IncidentDemoSeed {
  return clone({
    incidents,
    timeline,
    importBatches: [],
    users,
    categories,
    workspaceSnapshots: [],
  });
}
