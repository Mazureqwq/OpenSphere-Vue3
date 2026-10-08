import type {
  DemoUser,
  Incident,
  IncidentCategory,
  IncidentTimelineEntry,
  ImportBatch,
  IncidentWorkspaceSnapshot,
} from '../domain/types.ts';

export interface IncidentDemoSeed {
  incidents: Incident[];
  timeline: IncidentTimelineEntry[];
  importBatches: ImportBatch[];
  users: DemoUser[];
  categories: IncidentCategory[];
  workspaceSnapshots?: IncidentWorkspaceSnapshot[];
}

export interface IncidentWorkspaceRepository {
  initialize(seed: IncidentDemoSeed): Promise<void>;
  reset(seed: IncidentDemoSeed): Promise<void>;
  listIncidents(projectId: string): Promise<Incident[]>;
  getIncident(id: string): Promise<Incident | undefined>;
  saveIncidentWithTimeline(incident: Incident, timeline: IncidentTimelineEntry): Promise<void>;
  listTimeline(incidentId: string): Promise<IncidentTimelineEntry[]>;
  saveImportBatch(batch: ImportBatch): Promise<void>;
  getImportBatch(id: string): Promise<ImportBatch | undefined>;
  listImportBatches(projectId: string): Promise<ImportBatch[]>;
  deleteIncidentsWithTimeline(incidentIds: string[]): Promise<void>;
  listDemoUsers(): Promise<DemoUser[]>;
  replaceDemoUsers(users: DemoUser[]): Promise<void>;
  listCategories(): Promise<IncidentCategory[]>;
  replaceCategories(categories: IncidentCategory[]): Promise<void>;
  getWorkspaceSnapshot(projectId: string): Promise<IncidentWorkspaceSnapshot | undefined>;
  saveWorkspaceSnapshot(snapshot: IncidentWorkspaceSnapshot): Promise<void>;
  getSetting<T>(key: string): Promise<T | undefined>;
  setSetting<T>(key: string, value: T): Promise<void>;
  close(): void;
}
