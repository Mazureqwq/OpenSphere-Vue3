import { onBeforeUnmount, ref, toRaw, type Ref } from "vue";
import { ElMessage } from "element-plus";
import { SearchService } from "@/search/SearchService";
import type { SearchResult } from "@/search/types";
import type { LayerRecord } from "@/types/gis";
import type { MapViewState } from "@/types/workspace";
import type { useMapStore } from "@/stores/map";

type MapStore = ReturnType<typeof useMapStore>;
interface SearchMapView { getViewState: () => MapViewState | undefined; focusCoordinate: (coordinate: [number, number]) => void; }

export function useSearch(options: { mapStore: MapStore; mapView: Ref<SearchMapView | undefined>; currentView: Ref<MapViewState> }) {
  const results = ref<SearchResult[]>([]);
  const loading = ref(false);
  const service = new SearchService();
  let sequence = 0;

  async function search(term: string) {
    const currentSequence = ++sequence;
    loading.value = true;
    const response = await service.search(term, {
      layers: options.mapStore.layers.map((layer) => toRaw(layer) as unknown as LayerRecord),
      view: options.mapView.value?.getViewState() ?? options.currentView.value,
      limit: 12,
    });
    if (currentSequence !== sequence) return;
    results.value = response.results;
    loading.value = false;
  }

  function clear() {
    sequence += 1;
    loading.value = false;
    results.value = [];
    service.dispose();
  }

  function select(result: SearchResult) {
    if (!Number.isFinite(result.coordinate[0]) || !Number.isFinite(result.coordinate[1])) {
      ElMessage.warning("该搜索结果不包含可用坐标");
      return;
    }
    if (!options.mapView.value) {
      ElMessage.warning("地图尚未初始化，请稍后重试");
      return;
    }
    options.mapView.value.focusCoordinate(result.coordinate);
  }

  onBeforeUnmount(() => service.dispose());
  return { results, loading, service, search, clear, select };
}