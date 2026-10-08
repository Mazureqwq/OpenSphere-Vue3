import { computed, ref, watch } from 'vue';
import { defineStore } from 'pinia';
import { useMapStore } from './map';
import type { SelectedFeatureInfo } from '@/types/gis';

/**
 * 统一选中目标：任何面板与地图都通过 select()/clear() 读写，
 * current 由普通地图选中与事件选中共同派生，保证单一事实来源。
 */
export type SelectionTarget =
  | { kind: 'layer'; layerId: string }
  | { kind: 'feature'; layerId: string; featureId?: string }
  | { kind: 'incident'; incidentId: string };

export type SelectionInput =
  | { kind: 'layer'; layerId: string }
  | { kind: 'feature'; feature: SelectedFeatureInfo }
  | { kind: 'incident'; incidentId: string };

export const useSelectionStore = defineStore('selection', () => {
  const mapStore = useMapStore();
  const selectedIncidentId = ref<string>();

  const current = computed<SelectionTarget | null>(() => {
    if (selectedIncidentId.value) return { kind: 'incident', incidentId: selectedIncidentId.value };
    const feature = mapStore.selectedFeature;
    if (feature) return { kind: 'feature', layerId: feature.layerId, featureId: feature.featureId };
    const layerId = mapStore.selectedLayerId;
    return layerId ? { kind: 'layer', layerId } : null;
  });
  // Existing GIS commands sometimes update mapStore directly; those normal selections
  // must still release an active incident inspector.
  watch(
    () => [mapStore.selectedLayerId, mapStore.selectedFeature] as const,
    ([layerId, feature]) => { if (layerId || feature) selectedIncidentId.value = undefined; },
  );

  /** 新选中替换旧选中：事件和普通图层/要素详情互斥。 */
  function select(input: SelectionInput) {
    if (input.kind === 'incident') {
      selectedIncidentId.value = input.incidentId;
      mapStore.selectedFeature = undefined;
      mapStore.selectedLayerId = undefined;
      return;
    }
    selectedIncidentId.value = undefined;
    if (input.kind === 'feature') {
      mapStore.setSelectedFeature(input.feature);
      return;
    }
    mapStore.selectedFeature = undefined;
    mapStore.selectedLayerId = input.layerId;
  }

  /** 清除全部选中：五端（地图/图层树/检查器/属性表/结果）统一收起。 */
  function clear() {
    selectedIncidentId.value = undefined;
    mapStore.selectedFeature = undefined;
    mapStore.selectedLayerId = undefined;
  }

  return { current, select, clear };
});