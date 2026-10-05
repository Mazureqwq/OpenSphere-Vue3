<script setup lang="ts">
import {computed, ref} from 'vue';
import type {SelectedFeatureInfo} from '@/types/gis';
import {formatDisplayValue, formatFieldLabel, formatGeometryType} from '@/ui/display';

const props = defineProps<{feature: SelectedFeatureInfo; editable?: boolean}>();
const emit = defineEmits<{close: []; delete: []; focus: []}>();
const showAll = ref(false);
const allProperties = computed(() => Object.entries(props.feature.properties));
const properties = computed(() => (showAll.value ? allProperties.value : allProperties.value.slice(0, 6)));
const hiddenPropertyCount = computed(() => Math.max(0, allProperties.value.length - 6));

const metrics = computed(() => {
  const m = props.feature.metrics;
  if (!m) return [];
  const items: {label: string; value: string}[] = [];
  if (m.length != null) items.push({label: '长度', value: m.length >= 1000 ? `${(m.length / 1000).toFixed(2)} km` : `${m.length.toFixed(1)} m`});
  if (m.area != null) items.push({label: '面积', value: m.area >= 1000000 ? `${(m.area / 1000000).toFixed(2)} km²` : `${m.area.toFixed(1)} m²`});
  if (m.perimeter != null) items.push({label: '周长', value: m.perimeter >= 1000 ? `${(m.perimeter / 1000).toFixed(2)} km` : `${m.perimeter.toFixed(1)} m`});
  if (m.vertexCount != null) items.push({label: '顶点', value: String(m.vertexCount)});
  return items;
});
</script>

<template>
  <article class="map-feature-popup" @click.stop>
    <header class="map-feature-popup-header">
      <div><strong>{{ feature.layerName }}</strong><span>{{ formatGeometryType(feature.geometryType) }}</span></div>
      <button type="button" aria-label="关闭要素信息" @click="emit('close')">×</button>
    </header>
    <p v-if="feature.coordinate" class="map-feature-popup-coordinate">{{ feature.coordinate[0] }}, {{ feature.coordinate[1] }}</p>
    <dl v-if="metrics.length" class="map-feature-popup-metrics">
      <template v-for="item in metrics" :key="item.label"><dt>{{ item.label }}</dt><dd>{{ item.value }}</dd></template>
    </dl>
    <dl v-if="properties.length" class="map-feature-popup-properties">
      <template v-for="[key, value] in properties" :key="key"><dt>{{ formatFieldLabel(key) }}</dt><dd>{{ formatDisplayValue(value) || '—' }}</dd></template>
    </dl>
    <div v-if="hiddenPropertyCount" class="map-feature-popup-more">
      <button type="button" class="map-feature-popup-toggle" @click="showAll = !showAll">{{ showAll ? '收起' : `展开全部 ${hiddenPropertyCount} 个属性` }}</button>
    </div>
    <div class="map-feature-popup-actions">
      <button type="button" class="map-feature-popup-focus" @click="emit('focus')">定位</button>
      <button v-if="editable" type="button" class="map-feature-popup-delete" @click="emit('delete')">删除要素</button>
    </div>
  </article>
</template>

<style scoped>
.map-feature-popup {
  position: absolute;
  z-index: 5;
  right: 12px;
  bottom: 36px;
  width: min(280px, calc(100% - 36px));
  max-height: calc(100% - 120px);
  overflow: auto;
  padding: 10px 11px;
  border: 1px solid #3c6386;
  border-radius: 8px;
  background: rgba(8, 20, 35, 0.96);
  box-shadow: 0 10px 28px rgba(0, 0, 0, 0.35);
  color: #d9e8f7;
  font-size: 11px;
  pointer-events: auto;
}
.map-feature-popup-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 10px;
}
.map-feature-popup-header div {
  min-width: 0;
}
.map-feature-popup-header strong,
.map-feature-popup-header span {
  display: block;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.map-feature-popup-header strong {
  color: #f1f5f9;
  font-size: 12px;
}
.map-feature-popup-header span {
  margin-top: 3px;
  color: #69d9cf;
  font-size: 10px;
}
.map-feature-popup-header button {
  width: 19px;
  height: 19px;
  padding: 0;
  border: 0;
  color: #9bb4cb;
  background: transparent;
  font-size: 18px;
  line-height: 16px;
  cursor: pointer;
}
.map-feature-popup-header button:hover {
  color: #fff;
}
.map-feature-popup-coordinate {
  margin: 8px 0;
  color: #89a8c3;
  font-family: Consolas, monospace;
  font-size: 10px;
}
.map-feature-popup-metrics,
.map-feature-popup-properties {
  display: grid;
  grid-template-columns: minmax(52px, 0.6fr) minmax(0, 1.4fr);
  gap: 5px 8px;
  margin: 0;
  padding-top: 8px;
  border-top: 1px solid #1e3853;
}
.map-feature-popup-metrics dt,
.map-feature-popup-metrics dd,
.map-feature-popup-properties dt,
.map-feature-popup-properties dd {
  min-width: 0;
  margin: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.map-feature-popup-metrics dt,
.map-feature-popup-properties dt {
  color: #7893ae;
}
.map-feature-popup-metrics dd {
  color: #7dd3fc;
  font-family: Consolas, monospace;
}
.map-feature-popup-properties dd {
  color: #d7e5f3;
}
.map-feature-popup-more {
  margin: 8px 0 0;
}
.map-feature-popup-toggle {
  padding: 0;
  border: 0;
  background: transparent;
  color: #7dd3fc;
  font-size: 10px;
  cursor: pointer;
}
.map-feature-popup-actions {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
  margin-top: 10px;
}
.map-feature-popup-focus,
.map-feature-popup-delete {
  border-radius: 5px;
  padding: 4px 10px;
  cursor: pointer;
  font-size: 11px;
}
.map-feature-popup-focus {
  border: 1px solid rgba(125, 211, 252, 0.55);
  background: rgba(12, 74, 110, 0.35);
  color: #bae6fd;
}
.map-feature-popup-focus:hover {
  background: rgba(14, 116, 144, 0.5);
}
.map-feature-popup-delete {
  border: 1px solid rgba(248, 113, 113, 0.55);
  background: rgba(127, 29, 29, 0.35);
  color: #fecaca;
}
.map-feature-popup-delete:hover {
  background: rgba(185, 28, 28, 0.55);
}
</style>
