import { ref, type Ref } from 'vue';
import { ElMessage } from 'element-plus';
import type { MapFacade } from '@/map/facade';
import { useSearch } from '@/composables/useSearch';
import { useWorkspacePersistence } from '@/composables/useWorkspacePersistence';
import { useMapStore } from '@/stores/map';
import type { MapViewState } from '@/types/workspace';

export function useViewWorkspace(options: {
  mapFacade: Ref<MapFacade | undefined>;
  onBeforeRestore?: () => void;
  onBeforeClear?: () => void;
}) {
  const mapStore = useMapStore();
  const currentView = ref<MapViewState>({
    center: [113.6254, 34.7466],
    zoom: 5,
    rotation: 0,
  });
  const measurement = ref<string>();
  const pointerCoordinate = ref<[number, number]>();

  const persistence = useWorkspacePersistence({
    mapStore,
    mapView: options.mapFacade,
    currentView,
    onBeforeRestore: options.onBeforeRestore,
    onBeforeClear: options.onBeforeClear,
  });

  const search = useSearch({
    mapStore,
    mapView: options.mapFacade,
    currentView,
  });

  function handleBaseMapChange() {
    options.mapFacade.value?.setBaseMap(mapStore.activeBaseMap);
  }

  function locateCoordinate(coordinate: [number, number]) {
    if (!options.mapFacade.value) {
      ElMessage.warning('地图尚未初始化，请稍后重试');
      return;
    }
    options.mapFacade.value.locateCoordinate(coordinate);
    ElMessage.success('已定位到 ' + coordinate[0].toFixed(6) + ', ' + coordinate[1].toFixed(6));
  }

  function handleViewChange(state: MapViewState) {
    currentView.value = state;
    persistence.scheduleWorkspaceSave();
  }

  function handlePointerChange(coordinate?: [number, number]) {
    pointerCoordinate.value = coordinate;
  }

  function handleMeasurementChange(value?: string) {
    measurement.value = value;
  }

  return {
    currentView,
    measurement,
    pointerCoordinate,
    persistence,
    search,
    handleBaseMapChange,
    locateCoordinate,
    handleViewChange,
    handlePointerChange,
    handleMeasurementChange,
  };
}
