import { ref, toRaw, type Ref } from "vue";
import { ElMessage } from "element-plus";
import GeoJSON from "ol/format/GeoJSON";
import type BaseLayer from "ol/layer/Base";
import { createWmsLayer, type WmsLayerInput } from "@/map/ogc";
import { getVectorFeatures } from "@/map/styles";
import type { LayerRecord } from "@/types/gis";
import type { useMapStore } from "@/stores/map";

type MapStore = ReturnType<typeof useMapStore>;
export type LayerImportHandler = (file: File) => Promise<LayerRecord>;

export interface LayerActionsMapView {
  addLayer: (layer: LayerRecord, zoomToLayer?: boolean) => void;
  removeLayer: (id: string) => void;
  setDrawMode: (mode: "modify", layer?: LayerRecord) => void;
}

interface LayerActionsOptions {
  mapStore: MapStore;
  mapView: Ref<LayerActionsMapView | undefined>;
  importers: Record<string, LayerImportHandler>;
  onBeforeRemove?: (layer: LayerRecord) => void;
  onEdit?: (layer: LayerRecord) => void;
}

export function useLayerActions(options: LayerActionsOptions) {
  const importing = ref(false);

  function addLayer(layer: LayerRecord, zoomToLayer = false) {
    options.mapStore.addLayer(layer);
    options.mapView.value?.addLayer(layer, zoomToLayer);
  }

  async function handleFiles(files: FileList | null) {
    if (!files?.length) return;
    importing.value = true;
    try {
      for (const file of Array.from(files)) {
        const extension = file.name.split(".").pop()?.toLowerCase();
        const importer = extension ? options.importers[extension] : undefined;
        if (!importer) {
          ElMessage.warning(`${file.name} 不是支持的空间文件格式`);
          continue;
        }
        try {
          if (extension === "zip" || extension === "kmz") ElMessage.info(`正在后台解析 ${file.name}`);
          const layer = await importer(file);
          addLayer(layer, true);
          ElMessage.success(`已导入 ${file.name}，地图已定位到数据范围`);
        } catch (error) {
          ElMessage.error(error instanceof Error ? error.message : "文件导入失败");
        }
      }
    } finally {
      importing.value = false;
    }
  }

  function addWmsLayer(input: WmsLayerInput) {
    addLayer(createWmsLayer(input));
    ElMessage.success(`已添加 WMS 图层：${input.name}`);
  }

  function handleRemoveLayer(id: string) {
    const layer = options.mapStore.layers.find((item) => item.id === id);
    if (!layer) return;
    options.onBeforeRemove?.(toRaw(layer) as unknown as LayerRecord);
    options.mapView.value?.removeLayer(id);
    options.mapStore.removeLayer(id);
  }

  function editLayer(id: string) {
    const layer = options.mapStore.layers.find((item) => item.id === id);
    if (!layer?.vectorStyle || layer.kind !== "vector") {
      ElMessage.warning("当前图层不支持编辑");
      return;
    }
    if (options.mapStore.mapEngine === "3d") {
      ElMessage.warning("导入图层的顶点编辑请切换到 2D 地图");
      return;
    }
    options.mapStore.selectedLayerId = id;
    options.onEdit?.(toRaw(layer) as unknown as LayerRecord);
    options.mapView.value?.setDrawMode("modify", toRaw(layer) as unknown as LayerRecord);
  }

  function exportLayer(id: string) {
    const layer = options.mapStore.layers.find((item) => item.id === id);
    if (!layer || layer.kind !== "vector") {
      ElMessage.warning("当前图层不支持导出");
      return;
    }
    const features = getVectorFeatures(toRaw(layer.source) as unknown as BaseLayer);
    if (!features.length) {
      ElMessage.info("当前图层没有可导出的要素");
      return;
    }
    const content = new GeoJSON().writeFeatures(features, {
      featureProjection: "EPSG:3857",
      dataProjection: "EPSG:4326",
    });
    const blob = new Blob([content], { type: "application/geo+json;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${layer.name || "layer"}.geojson`;
    link.click();
    URL.revokeObjectURL(url);
    ElMessage.success(`已导出图层：${layer.name}`);
  }

  return { importing, addLayer, handleFiles, addWmsLayer, handleRemoveLayer, editLayer, exportLayer };
}