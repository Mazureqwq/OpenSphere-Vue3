import { computed, nextTick, onBeforeUnmount, onMounted, ref, toRaw, watch, type Ref } from "vue";
import { ElMessage, ElMessageBox } from "element-plus";
import type { BaseMapOption, LayerRecord } from "@/types/gis";
import type { MapViewState } from "@/types/workspace";
import { clearWorkspace, createSnapshot, loadWorkspace, restoreLayers, saveWorkspace } from "@/workspace";
import type { useMapStore } from "@/stores/map";

type MapStore = ReturnType<typeof useMapStore>;

export interface WorkspaceMapView {
  clearLayers: () => void;
  setBaseMap: (baseMap: BaseMapOption) => void;
  getViewState: () => MapViewState | undefined;
  setViewState: (state: MapViewState) => void;
  addLayer: (layer: LayerRecord, zoomToLayer?: boolean) => void;
}

interface WorkspacePersistenceOptions {
  mapStore: MapStore;
  mapView: Ref<WorkspaceMapView | undefined>;
  currentView: Ref<MapViewState>;
  onBeforeRestore?: () => void;
  onBeforeClear?: () => void;
}

export function useWorkspacePersistence(options: WorkspacePersistenceOptions) {
  const workspaceReady = ref(false);
  let saveTimer: ReturnType<typeof setTimeout> | undefined;

  const workspaceState = computed(() => ({
    baseMapId: options.mapStore.activeBaseMapId,
    selectedLayerId: options.mapStore.selectedLayerId,
    timeEnabled: options.mapStore.timeEnabled,
    timeCursor: options.mapStore.timeCursor,
    timeRange: options.mapStore.timeRange,
    query: options.mapStore.query,
    layers: options.mapStore.layers
      .filter((layer) => !layer.realtime && !layer.demo)
      .map((layer) => ({
        id: layer.id,
        visible: layer.visible,
        opacity: layer.opacity,
        vectorStyle: layer.vectorStyle,
        categoryStyle: layer.categoryStyle,
        timeFilter: layer.timeFilter,
        drawing: layer.drawing,
        featureCount: layer.featureCount,
      })),
  }));

  function persistWorkspace() {
    const view = options.mapView.value?.getViewState() ?? options.currentView.value;
    saveWorkspace(createSnapshot({
      baseMapId: options.mapStore.activeBaseMapId,
      selectedLayerId: options.mapStore.selectedLayerId,
      timeEnabled: options.mapStore.timeEnabled,
      timeCursor: options.mapStore.timeCursor,
      timeRange: options.mapStore.timeRange,
      query: options.mapStore.query,
      view,
      layers: options.mapStore.layers.map((layer) => toRaw(layer) as unknown as LayerRecord),
    }));
  }

  function scheduleWorkspaceSave() {
    if (!workspaceReady.value) return;
    if (saveTimer) clearTimeout(saveTimer);
    saveTimer = setTimeout(persistWorkspace, 400);
  }

  function saveWorkspaceNow() {
    persistWorkspace();
    ElMessage.success("工作区已保存到当前浏览器");
  }

  function restoreWorkspaceState(notify = true) {
    const snapshot = loadWorkspace();
    if (!snapshot) {
      if (notify) ElMessage.info("未找到已保存的工作区");
      return;
    }

    workspaceReady.value = false;
    options.onBeforeRestore?.();
    options.mapView.value?.clearLayers();
    options.mapStore.clearLayers();
    options.mapStore.setBaseMap(snapshot.baseMapId);
    options.mapStore.timeEnabled = snapshot.timeEnabled;
    options.mapStore.timeCursor = snapshot.timeCursor;
    options.mapStore.setTimeRange(snapshot.timeRange);
    options.mapStore.setQuery(snapshot.query);
    options.mapStore.selectedLayerId = snapshot.selectedLayerId;
    options.mapView.value?.setBaseMap(options.mapStore.activeBaseMap);

    try {
      const restored = restoreLayers(snapshot);
      options.mapStore.replaceLayers(restored);
      options.mapStore.refreshFilters();
      restored.forEach((layer) => options.mapView.value?.addLayer(layer));
      options.currentView.value = snapshot.view;
      options.mapView.value?.setViewState(snapshot.view);
      if (notify) ElMessage.success(`已恢复工作区：${restored.length} 个图层`);
    } catch (error) {
      ElMessage.error(error instanceof Error ? `工作区恢复失败：${error.message}` : "工作区恢复失败");
    } finally {
      workspaceReady.value = true;
    }
  }

  async function clearWorkspaceState() {
    await ElMessageBox.confirm(
      "这将移除浏览器保存的工作区，并清空当前地图中的业务图层。",
      "清空工作区",
      { confirmButtonText: "清空", cancelButtonText: "取消", type: "warning" },
    );
    clearWorkspace();
    options.onBeforeClear?.();
    options.mapView.value?.clearLayers();
    options.mapStore.clearLayers();
    ElMessage.success("工作区已清空");
  }

  onMounted(async () => {
    await nextTick();
    restoreWorkspaceState(false);
    workspaceReady.value = true;
  });

  onBeforeUnmount(() => {
    if (saveTimer) clearTimeout(saveTimer);
  });

  watch(workspaceState, scheduleWorkspaceSave, { deep: true });

  return {
    workspaceReady,
    persistWorkspace,
    scheduleWorkspaceSave,
    saveWorkspaceNow,
    restoreWorkspaceState,
    clearWorkspaceState,
  };
}