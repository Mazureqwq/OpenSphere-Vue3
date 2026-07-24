import { ref, toRaw, type Ref } from "vue";
import { ElMessage } from "element-plus";
import type { LayerRecord, PointVisualizationConfig } from "@/types/gis";
import type { useMapStore } from "@/stores/map";

type MapStore = ReturnType<typeof useMapStore>;
interface VisualizationMapView { setPointVisualization: (layer: LayerRecord, config: PointVisualizationConfig) => boolean; clearPointVisualization: () => void; }

export function usePointVisualization(options: { mapStore: MapStore; mapView: Ref<VisualizationMapView | undefined> }) {
  function apply(layerId: string, config: PointVisualizationConfig) {
    const layer = options.mapStore.layers.find((item) => item.id === layerId);
    if (!layer?.vectorStyle) {
      ElMessage.warning("请选择包含点要素的矢量图层");
      return;
    }
    const applied = options.mapView.value?.setPointVisualization(toRaw(layer) as unknown as LayerRecord, config) ?? false;
    if (!applied) {
      ElMessage.warning("当前图层没有可用于展示的点要素");
      return;
    }
    options.mapStore.selectedLayerId = layer.id;
    ElMessage.success(config.mode === "heatmap" ? "已应用热力展示" : "已应用聚合气泡展示");
  }
  function clear() {
    options.mapView.value?.clearPointVisualization();
    ElMessage.info("已恢复原始点位展示");
  }
  return { apply, clear };
}