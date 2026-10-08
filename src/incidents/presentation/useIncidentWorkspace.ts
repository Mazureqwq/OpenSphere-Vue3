import { computed, ref, watch, type Ref } from 'vue';
import type { MapFacade } from '@/map/facade';
import type { LayerRecord } from '@/types/gis';
import { useMapStore } from '@/stores/map';
import { createDemoIncidentSeed } from '../application/demoData.ts';
import type { IncidentImportFieldMapping, IncidentImportSource } from '../application/incidentImport.ts';
import { IncidentService, type IncidentImportResult } from '../application/incidentService.ts';
import { demoRoles, type DemoRole, type Incident, type IncidentDraft } from '../domain/types.ts';
import { createIndexedDbIncidentRepository, type IncidentRepositoryError } from '../repositories/indexedDbIncidentRepository.ts';
import type { IncidentWorkspaceRepository } from '../repositories/contracts.ts';
import { INCIDENT_SYSTEM_LAYER_ID, syncIncidentSystemProjection } from './incidentMapLayer.ts';
import type { IncidentWorkspaceContext } from './incidentContext.ts';

const demoRoleStorageKey = 'graphite-atlas-demo-role';

type MapStore = ReturnType<typeof useMapStore>;

export interface IncidentWorkspaceOptions {
  mapFacade: Ref<MapFacade | undefined>;
  mapStore?: MapStore;
  repository?: IncidentWorkspaceRepository;
  service?: IncidentService;
  storage?: Pick<Storage, 'getItem' | 'setItem'>;
}

function messageFor(error: unknown): string {
  if (error && typeof error === 'object' && 'message' in error && typeof error.message === 'string') return error.message;
  return '本地事件数据暂时无法使用。';
}

function readRole(storage?: Pick<Storage, 'getItem'>): DemoRole {
  const stored = storage?.getItem(demoRoleStorageKey);
  return demoRoles.includes(stored as DemoRole) ? stored as DemoRole : 'admin';
}

export function useIncidentWorkspace(options: IncidentWorkspaceOptions): IncidentWorkspaceContext {
  const mapStore = options.mapStore ?? useMapStore();
  const repository = options.repository ?? createIndexedDbIncidentRepository();
  const service = options.service ?? new IncidentService(repository);
  const storage = options.storage ?? (typeof window === 'undefined' ? undefined : window.localStorage);
  const ready = ref(false);
  const error = ref<string>();
  const currentRole = ref<DemoRole>(readRole(storage));
  const incidents = ref<Incident[]>([]);
  const users = ref([] as Awaited<ReturnType<IncidentWorkspaceRepository['listDemoUsers']>>);
  const categories = ref([] as Awaited<ReturnType<IncidentWorkspaceRepository['listCategories']>>);
  const importBatches = ref([] as Awaited<ReturnType<IncidentWorkspaceRepository['listImportBatches']>>);
  const selectedIncidentId = ref<string>();
  const selectedIncident = computed(() => incidents.value.find((incident) => incident.id === selectedIncidentId.value));

  function projectionHost() {
    return {
      get layers() { return mapStore.layers as unknown as LayerRecord[]; },
      addSystemLayer(layer: LayerRecord) { mapStore.addLayer(layer, false); },
      removeSystemLayer(id: string) { mapStore.removeLayer(id); },
    };
  }

  function syncMapProjection(): void {
    if (!ready.value) return;
    syncIncidentSystemProjection(projectionHost(), incidents.value, options.mapFacade.value);
  }

  async function refresh(): Promise<void> {
    incidents.value = await service.listIncidents();
    users.value = await repository.listDemoUsers();
    categories.value = await repository.listCategories();
    importBatches.value = await repository.listImportBatches('local-demo');
    if (selectedIncidentId.value && !incidents.value.some((incident) => incident.id === selectedIncidentId.value)) {
      selectedIncidentId.value = undefined;
    }
  }

  async function hydrate(): Promise<void> {
    ready.value = false;
    error.value = undefined;
    try {
      await service.initialize(createDemoIncidentSeed());
      await refresh();
      ready.value = true;
      syncMapProjection();
    } catch (cause) {
      error.value = messageFor(cause as IncidentRepositoryError);
      ready.value = false;
    }
  }

  function setRole(role: DemoRole): void {
    currentRole.value = role;
    storage?.setItem(demoRoleStorageKey, role);
  }

  function selectIncident(incidentId?: string): void {
    selectedIncidentId.value = incidentId;
  }

  function focusIncident(incidentId: string): void {
    selectIncident(incidentId);
    const layer = mapStore.layers.find((item) => item.id === INCIDENT_SYSTEM_LAYER_ID);
    if (layer) options.mapFacade.value?.focusFeature(layer as unknown as LayerRecord, incidentId);
  }

  async function mutate<T>(operation: () => Promise<T>): Promise<T> {
    error.value = undefined;
    try {
      const result = await operation();
      await refresh();
      syncMapProjection();
      return result;
    } catch (cause) {
      error.value = messageFor(cause);
      throw cause;
    }
  }

  async function create(draft: IncidentDraft): Promise<Incident> { return mutate(() => service.create(draft, actor())); }
  async function importText(source: IncidentImportSource, mapping?: IncidentImportFieldMapping): Promise<IncidentImportResult> { return mutate(() => service.importText(source, actor(), mapping)); }
  async function assign(incidentId: string, assignedTo: string): Promise<Incident> { return mutate(() => service.assign(incidentId, assignedTo, actor())); }
  async function start(incidentId: string): Promise<Incident> { return mutate(() => service.start(incidentId, actor())); }
  async function update(incidentId: string, note: string): Promise<Incident> { return mutate(() => service.update(incidentId, note, actor())); }
  async function submitForReview(incidentId: string, note: string): Promise<Incident> { return mutate(() => service.submitForReview(incidentId, note, actor())); }
  async function approve(incidentId: string, note?: string): Promise<Incident> { return mutate(() => service.approve(incidentId, note, actor())); }
  async function returnForRework(incidentId: string, reason: string): Promise<Incident> { return mutate(() => service.returnForRework(incidentId, reason, actor())); }
  async function cancel(incidentId: string, reason: string): Promise<Incident> { return mutate(() => service.cancel(incidentId, reason, actor())); }
  async function revokeImportBatch(batchId: string): Promise<void> { return mutate(() => service.revokeImportBatch(batchId, actor())); }
  async function getTimeline(incidentId: string) { return repository.listTimeline(incidentId); }
  async function resetDemoData(): Promise<void> { return mutate(async () => repository.reset(createDemoIncidentSeed())); }

  function actor() {
    const found = users.value.find((user) => user.role === currentRole.value);
    return found ?? { id: `demo-${currentRole.value}`, name: currentRole.value, role: currentRole.value };
  }

  watch(options.mapFacade, (facade) => {
    if (facade && ready.value) syncMapProjection();
  });

  return {
    ready,
    error,
    currentRole,
    incidents,
    users,
    categories,
    importBatches,
    selectedIncidentId,
    selectedIncident,
    hydrate,
    refresh,
    syncMapProjection,
    setRole,
    selectIncident,
    focusIncident,
    create,
    importText,
    assign,
    start,
    update,
    submitForReview,
    approve,
    returnForRework,
    cancel,
    revokeImportBatch,
    getTimeline,
    resetDemoData,
  };
}
