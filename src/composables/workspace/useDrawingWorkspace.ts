import { toRaw, type Ref } from 'vue';
import { ElMessage } from 'element-plus';
import { createVectorLayer } from '@/map/drawing';
import { getLayerName } from '@/core/mapInteraction.js';
import type { MapFacade } from '@/map/facade';
import { useDrawingSession } from '@/composables/useDrawingSession';
import { useMapStore } from '@/stores/map';
import type { LayerRecord } from '@/types/gis';

export function useDrawingWorkspace(options: {
  mapFacade: Ref<MapFacade | undefined>;
  measurement: Ref<string | undefined>;
  addLayer: (layer: LayerRecord, zoomToLayer?: boolean) => void;
  scheduleWorkspaceSave: () => void;
}) {
  const mapStore = useMapStore();
  const session = useDrawingSession({
    mapStore,
    mapView: options.mapFacade,
    measurement: options.measurement,
  });

  function createDrawingLayer(name?: string, layerType: 'drawing' | 'vector' = 'drawing') {
    const drawingCount = mapStore.layers.filter((item) => item.drawing).length;
    const vectorCount = mapStore.layers.filter((item) => item.kind === 'vector' && !item.drawing).length;
    const isDrawingLayer = layerType === 'drawing';
    const layer = createVectorLayer(
      getLayerName({ name, layerType, drawingCount, vectorCount }),
      isDrawingLayer,
    );
    options.addLayer(layer);
    mapStore.selectedLayerId = layer.id;
    session.start(layer.id);
    ElMessage.success(`已创建${layer.name}`);
  }

  function handleDrawingChange() {
    const layer = mapStore.layers.find(
      (item) => item.id === session.drawingSessionLayerId.value && item.kind === 'vector',
    );
    if (layer) mapStore.refreshFeatureCount(layer.id);
    options.scheduleWorkspaceSave();
  }

  function openExistingDrawingSession() {
    if (session.drawingSessionLayerId.value) return;
    const layer = mapStore.layers.find((item) => item.drawing);
    if (layer) session.start(layer.id);
  }

  return {
    ...session,
    createDrawingLayer,
    handleDrawingChange,
    openExistingDrawingSession,
  };
}
