import type { Ref } from 'vue';
import type { MapFacade } from '@/map/facade';
import { ElMessage } from 'element-plus';
import {
  importCsv,
  importGeoJson,
  importGeoJsonFromUrl,
  importGpx,
  importKml,
  importKmz,
  importShapefile,
} from '@/map/importers';
import { useLayerActions, type LayerImportHandler } from '@/composables/useLayerActions';
import { useMapStore } from '@/stores/map';
import type { LayerRecord } from '@/types/gis';

const importers: Record<string, LayerImportHandler> = {
  csv: importCsv,
  geojson: importGeoJson,
  json: importGeoJson,
  kml: importKml,
  kmz: importKmz,
  gpx: importGpx,
  zip: importShapefile,
};

export function useLayerWorkspace(options: {
  mapFacade: Ref<MapFacade | undefined>;
  onBeforeRemove?: (layer: LayerRecord) => void;
  onEdit?: (layer: LayerRecord) => void;
}) {
  const mapStore = useMapStore();
  const actions = useLayerActions({
    mapStore,
    mapView: options.mapFacade,
    importers,
    onBeforeRemove: options.onBeforeRemove,
    onEdit: options.onEdit,
  });

  function dedupeDemoLayers() {
    const demoName = '示例空间数据';
    const copies = mapStore.layers.filter((layer) => layer.demo || layer.name === demoName);
    copies.slice(1).forEach((layer) => actions.handleRemoveLayer(layer.id));
    if (copies[0]) copies[0].demo = true;
    return copies.length > 0;
  }

  async function loadDemoData() {
    if (dedupeDemoLayers()) return;
    try {
      const layer = await importGeoJsonFromUrl('/data/spatial-query-demo.geojson', '示例空间数据');
      layer.demo = true;
      if (dedupeDemoLayers()) return;
      actions.addLayer(layer, true);
      ElMessage.success('已加载示例空间数据');
    } catch (error) {
      console.warn('[demo-data] 示例空间数据加载失败', error);
    }
  }

  return { ...actions, loadDemoData };
}
