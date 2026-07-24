import { ref, toRaw, type Ref } from "vue";
import { ElMessage } from "element-plus";
import type { DrawMode } from "@/map/drawing";
import type { LayerRecord } from "@/types/gis";
import type { useMapStore } from "@/stores/map";

type MapStore = ReturnType<typeof useMapStore>;

export interface DrawingMapView {
  setDrawMode: (mode?: DrawMode, layer?: LayerRecord) => void;
  deleteSelectedDrawingFeatures: (layer?: LayerRecord) => number;
}

interface DrawingSessionOptions {
  mapStore: MapStore;
  mapView: Ref<DrawingMapView | undefined>;
  measurement: Ref<string | undefined>;
}

export function useDrawingSession(options: DrawingSessionOptions) {
  const drawingSessionLayerId = ref<string>();
  const drawingEditing = ref(false);
  const activeDrawingMode = ref<DrawMode>();

  function getLayer() {
    return options.mapStore.layers.find(
      (layer) => layer.id === drawingSessionLayerId.value && layer.kind === "vector",
    ) ?? options.mapStore.layers.find((layer) => layer.drawing);
  }

  function start(layerId: string, editing = false) {
    drawingSessionLayerId.value = layerId;
    drawingEditing.value = editing;
  }

  function setDrawMode(mode: DrawMode) {
    const layer = getLayer();
    if (!layer) {
      ElMessage.warning("请先创建绘制图层");
      return;
    }
    options.mapStore.selectedLayerId = layer.id;
    activeDrawingMode.value = mode;
    options.mapView.value?.setDrawMode(mode, toRaw(layer) as unknown as LayerRecord);
  }

  function cancelCurrentDrawing() {
    options.mapView.value?.setDrawMode();
    options.measurement.value = undefined;
    activeDrawingMode.value = undefined;
  }

  function stopDrawing() {
    cancelCurrentDrawing();
    drawingSessionLayerId.value = undefined;
    drawingEditing.value = false;
  }

  function deleteSelectedDrawingFeatures() {
    const layer = getLayer();
    const deleted = options.mapView.value?.deleteSelectedDrawingFeatures(
      layer ? (toRaw(layer) as unknown as LayerRecord) : undefined,
    ) ?? 0;
    if (!deleted) {
      ElMessage.info("请先点击选中绘制要素");
      return;
    }
    if (layer) options.mapStore.refreshFeatureCount(layer.id);
    ElMessage.success(`已删除 ${deleted} 个绘制要素`);
  }

  return {
    drawingSessionLayerId,
    drawingEditing,
    activeDrawingMode,
    getLayer,
    start,
    setDrawMode,
    cancelCurrentDrawing,
    stopDrawing,
    deleteSelectedDrawingFeatures,
  };
}