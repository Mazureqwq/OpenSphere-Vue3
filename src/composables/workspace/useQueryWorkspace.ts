import { toRaw, type Ref } from 'vue';
import { ElMessage } from 'element-plus';
import type { MapFacade } from '@/map/facade';
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

  function focusQueryResult(layerId: string, featureId: string) {
    const layer = mapStore.layers.find((item) => item.id === layerId);
    if (layer) {
      options.mapFacade.value?.focusFeature(toRaw(layer) as unknown as LayerRecord, featureId);
    }
  }

  return {
    requestSpatialQuery,
    focusQueryResult,
  };
}
