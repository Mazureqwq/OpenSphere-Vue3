import { computed } from 'vue';
import { defineStore } from 'pinia';
import { useMapStore } from './map';
import type { SelectedFeatureInfo } from '@/types/gis';

/**
 * 统一选中目标：任何面板与地图都通过 select()/clear() 读写，
 * current 由 mapStore 的选中字段派生，保证单一事实来源。
 */
export type SelectionTarget =
  | { kind: 'layer'; layerId: string }
  | { kind: 'feature'; layerId: string; featureId?: string };

export type SelectionInput =
  | { kind: 'layer'; layerId: string }
  | { kind: 'feature'; feature: SelectedFeatureInfo };

export const useSelectionStore = defineStore('selection', () => {
  const mapStore = useMapStore();

  const current = computed<SelectionTarget | null>(() => {
    const feature = mapStore.selectedFeature;
    if (feature) return { kind: 'feature', layerId: feature.layerId, featureId: feature.featureId };
    const layerId = mapStore.selectedLayerId;
    return layerId ? { kind: 'layer', layerId } : null;
  });

  /** 新选中替换旧选中：选图层会清除要素选中，反之亦然。 */
  function select(input: SelectionInput) {
    if (input.kind === 'feature') {
      mapStore.setSelectedFeature(input.feature);
      return;
    }
    mapStore.selectedFeature = undefined;
    mapStore.selectedLayerId = input.layerId;
  }

  /** 清除全部选中：五端（地图/图层树/检查器/属性表/结果）统一收起。 */
  function clear() {
    mapStore.selectedFeature = undefined;
    mapStore.selectedLayerId = undefined;
  }

  return { current, select, clear };
});
