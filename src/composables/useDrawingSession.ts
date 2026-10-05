import { ref, toRaw, type Ref } from "vue";
import { ElMessage, ElMessageBox } from "element-plus";
import type { DrawMode } from "@/map/drawing";
import type { LayerRecord } from "@/types/gis";
import type { useMapStore } from "@/stores/map";

type MapStore = ReturnType<typeof useMapStore>;

export interface DrawingMapView {
  setDrawMode: (mode?: DrawMode, layer?: LayerRecord) => void;
  finishDrawing: () => void;
  abortDrawing: () => void;
  clearDrawingFeatures: (layer: LayerRecord) => void;
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
    if (mode === 'measureLine' || mode === 'measureArea') {
      activeDrawingMode.value = mode;
      options.mapView.value?.setDrawMode(mode);
      return;
    }
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
    options.mapView.value?.abortDrawing();
    options.mapView.value?.setDrawMode();
    options.measurement.value = undefined;
    activeDrawingMode.value = undefined;
  }

  function finishCurrentDrawing() {
    options.mapView.value?.finishDrawing();
    options.mapView.value?.setDrawMode();
    options.measurement.value = undefined;
    activeDrawingMode.value = undefined;
  }

  function clearDrawingFeatures() {
    const layer = getLayer();
    if (!layer) {
      ElMessage.warning("请先创建绘制图层");
      return;
    }
    ElMessageBox.confirm("将删除当前绘制图层的所有要素，此操作不可撤销。", "清除全部绘制", { type: "warning", confirmButtonText: "清除", cancelButtonText: "取消" })
      .then(() => {
        options.mapView.value?.clearDrawingFeatures(toRaw(layer) as unknown as LayerRecord);
        options.mapStore.refreshFeatureCount(layer.id);
        ElMessage.success("已清除全部绘制要素");
      })
      .catch(() => {});
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
    finishCurrentDrawing,
    cancelCurrentDrawing,
    stopDrawing,
    deleteSelectedDrawingFeatures,
    clearDrawingFeatures,
  };
}