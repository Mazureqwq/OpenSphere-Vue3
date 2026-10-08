import type {
  DemoUser,
  Incident,
  IncidentCategory,
  IncidentTimelineEntry,
  ImportBatch,
  IncidentWorkspaceSnapshot,
} from '../domain/types.ts';
import type { IncidentDemoSeed, IncidentWorkspaceRepository } from './contracts.ts';

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

export function createMemoryIncidentRepository(): IncidentWorkspaceRepository {
  const incidents = new Map<string, Incident>();
  const timeline = new Map<string, IncidentTimelineEntry>();
  const batches = new Map<string, ImportBatch>();
  const users = new Map<string, DemoUser>();
  const categories = new Map<string, IncidentCategory>();
  const snapshots = new Map<string, IncidentWorkspaceSnapshot>();
  const settings = new Map<string, unknown>();
  let initialized = false;

  function applySeed(seed: IncidentDemoSeed): void {
    seed.incidents.forEach((item) => incidents.set(item.id, clone(item)));
    seed.timeline.forEach((item) => timeline.set(item.id, clone(item)));
    seed.importBatches.forEach((item) => batches.set(item.id, clone(item)));
    seed.users.forEach((item) => users.set(item.id, clone(item)));
    seed.categories.forEach((item) => categories.set(item.id, clone(item)));
    seed.workspaceSnapshots?.forEach((item) => snapshots.set(item.projectId, clone(item)));
  }

  return {
    async initialize(seed) {
      if (initialized) return;
      applySeed(seed);
      initialized = true;
    },
    async reset(seed) {
      incidents.clear(); timeline.clear(); batches.clear(); users.clear(); categories.clear(); snapshots.clear(); settings.clear();
      applySeed(seed);
      initialized = true;
    },
    async listIncidents(projectId) { return [...incidents.values()].filter((item) => item.projectId === projectId).map(clone); },
    async getIncident(id) { const value = incidents.get(id); return value && clone(value); },
    async saveIncidentWithTimeline(incident, entry) { incidents.set(incident.id, clone(incident)); timeline.set(entry.id, clone(entry)); },
    async listTimeline(incidentId) { return [...timeline.values()].filter((item) => item.incidentId === incidentId).sort((a, b) => a.at.localeCompare(b.at)).map(clone); },
    async saveImportBatch(batch) { batches.set(batch.id, clone(batch)); },
    async getImportBatch(id) { const value = batches.get(id); return value && clone(value); },
    async listImportBatches(projectId) { return [...batches.values()].filter((item) => item.projectId === projectId).sort((a, b) => b.importedAt.localeCompare(a.importedAt)).map(clone); },
    async deleteIncidentsWithTimeline(ids) { const selected = new Set(ids); ids.forEach((id) => incidents.delete(id)); [...timeline.values()].filter((item) => selected.has(item.incidentId)).forEach((item) => timeline.delete(item.id)); },
    async listDemoUsers() { return [...users.values()].map(clone); },
    async replaceDemoUsers(nextUsers) { users.clear(); nextUsers.forEach((item) => users.set(item.id, clone(item))); },
    async listCategories() { return [...categories.values()].map(clone); },
    async replaceCategories(nextCategories) { categories.clear(); nextCategories.forEach((item) => categories.set(item.id, clone(item))); },
    async getWorkspaceSnapshot(projectId) { const value = snapshots.get(projectId); return value && clone(value); },
    async saveWorkspaceSnapshot(snapshot) { snapshots.set(snapshot.projectId, clone(snapshot)); },
    async getSetting(key) { const value = settings.get(key); return value === undefined ? undefined : clone(value as never); },
    async setSetting(key, value) { settings.set(key, clone(value)); },
    close() {},
  };
}
