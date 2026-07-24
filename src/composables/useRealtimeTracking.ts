import { onBeforeUnmount, ref, toRaw, type Ref } from "vue";
import { ElMessage } from "element-plus";
import { createRealtimeLayer, RealtimeTrackService, type RealtimeStatus } from "@/map/realtime";
import type { LayerRecord } from "@/types/gis";
import type { useMapStore } from "@/stores/map";

type MapStore = ReturnType<typeof useMapStore>;

interface RealtimeMapView {
  syncRealtimeLayer: (layer?: LayerRecord) => void;
}

interface RealtimeTrackingOptions {
  mapStore: MapStore;
  mapView: Ref<RealtimeMapView | undefined>;
  addLayer: (layer: LayerRecord, zoomToLayer?: boolean) => void;
}

export function useRealtimeTracking(options: RealtimeTrackingOptions) {
  const status = ref<RealtimeStatus>("disconnected");
  const trackCount = ref(0);
  const lastUpdated = ref<string>();
  const error = ref<string>();
  const layerId = ref<string>();

  const service = new RealtimeTrackService(
    (state) => {
      status.value = state.status;
      trackCount.value = state.trackCount;
      lastUpdated.value = state.lastUpdated;
      error.value = state.error;
      if (layerId.value) options.mapStore.refreshFeatureCount(layerId.value);
    },
    (layer) => options.mapView.value?.syncRealtimeLayer(layer),
  );

  function ensureLayer() {
    const existing = layerId.value
      ? options.mapStore.layers.find((layer) => layer.id === layerId.value)
      : undefined;
    if (existing) return toRaw(existing) as unknown as LayerRecord;
    const layer = createRealtimeLayer();
    options.addLayer(layer);
    layerId.value = layer.id;
    service.attachLayer(layer);
    return layer;
  }

  function connect(url: string) {
    const layer = ensureLayer();
    try {
      service.connect(url);
      options.mapStore.selectedLayerId = layer.id;
    } catch (connectError) {
      ElMessage.error(connectError instanceof Error ? connectError.message : "WebSocket 连接失败");
    }
  }

  function disconnect() {
    service.disconnect();
  }

  function startSimulation() {
    const layer = ensureLayer();
    service.startSimulation();
    options.mapStore.selectedLayerId = layer.id;
  }

  function stopSimulation() {
    service.stopSimulation();
  }

  function stop() {
    service.detachLayer();
    layerId.value = undefined;
  }

  onBeforeUnmount(() => service.dispose());

  return {
    service,
    status,
    trackCount,
    lastUpdated,
    error,
    layerId,
    ensureLayer,
    connect,
    disconnect,
    startSimulation,
    stopSimulation,
    stop,
  };
}