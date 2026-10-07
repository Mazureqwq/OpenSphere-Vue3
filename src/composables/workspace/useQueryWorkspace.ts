import { toRaw, type Ref } from 'vue';
import type BaseLayer from 'ol/layer/Base';
import { ElMessage } from 'element-plus';
import type { MapFacade } from '@/map/facade';
import { getVectorFeatures } from '@/map/styles';
import { useMapStore } from '@/stores/map';
import type { LayerRecord } from '@/types/gis';

export function useQueryWorkspace(options: {
  mapFacade: Ref<MapFacade | undefined>;
}) {
  const mapStore = useMapStore();

  function requestSpatialQuery() {
    options.mapFacade.value?.startSpatialQuery((extent) => {
      mapStore.setQueryExtent(extent);
      ElMessage.success('已应用空间范围筛选');
    });
    ElMessage.info('请在地图上按住 Shift 并拖拽矩形范围');
  }

  /** 结果条目点击 = 地图定位闪烁 + 统一选中（右侧检查器同步显示要素详情）。 */
  function focusQueryResult(layerId: string, featureId: string) {
    const layer = mapStore.layers.find((item) => item.id === layerId);
    if (!layer) return;
    options.mapFacade.value?.focusFeature(toRaw(layer) as unknown as LayerRecord, featureId);
    const properties = mapStore.queryResults.find((item) => item.id === featureId)?.properties;
    if (!properties) return;
    const source = toRaw(layer.source) as unknown as BaseLayer;
    const feature = getVectorFeatures(source).find((item) => String(item.getId() ?? '') === featureId);
    mapStore.setSelectedFeature({
      featureId,
      layerId,
      layerName: layer.name,
      geometryType: feature?.getGeometry()?.getType() ?? '',
      properties,
    });
  }

  return {
    requestSpatialQuery,
    focusQueryResult,
  };
}
