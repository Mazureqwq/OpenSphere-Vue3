<script setup lang="ts">
import {computed} from 'vue';
import type {SelectedFeatureInfo} from '@/types/gis';
import {formatDisplayValue, formatFieldLabel, formatGeometryType} from '@/ui/display';

const props = defineProps<{feature: SelectedFeatureInfo; position: {x: number; y: number}; editable?: boolean}>();
const emit = defineEmits<{close: []; delete: []}>();
const properties = computed(() => Object.entries(props.feature.properties).slice(0, 6));
const hiddenPropertyCount = computed(() => Math.max(0, Object.keys(props.feature.properties).length - properties.value.length));
</script>

<template>
  <article class="map-feature-popup" :style="{left: position.x + 'px', top: position.y + 'px'}" @click.stop>
    <header class="map-feature-popup-header"><div><strong>{{ feature.layerName }}</strong><span>{{ formatGeometryType(feature.geometryType) }}</span></div><button type="button" aria-label="关闭要素信息" @click="emit('close')">×</button></header>
    <p v-if="feature.coordinate" class="map-feature-popup-coordinate">{{ feature.coordinate[0] }}, {{ feature.coordinate[1] }}</p>
    <dl v-if="properties.length" class="map-feature-popup-properties"><template v-for="[key, value] in properties" :key="key"><dt>{{ formatFieldLabel(key) }}</dt><dd>{{ formatDisplayValue(value) || '—' }}</dd></template></dl>
    <div v-if="editable" class="map-feature-popup-actions"><button type="button" class="map-feature-popup-delete" @click="emit('delete')">删除要素</button></div>
    <p v-if="hiddenPropertyCount" class="map-feature-popup-more">还有 {{ hiddenPropertyCount }} 个属性请在左侧要素信息中查看</p>
  </article>
</template>



<style scoped>
.map-feature-popup {
  position: absolute;
  z-index: 5;
  width: min(280px, calc(100% - 36px));
  padding: 10px 11px;
  border: 1px solid #3c6386;
  border-radius: 8px;
  background: rgba(8, 20, 35, 0.96);
  box-shadow: 0 10px 28px rgba(0, 0, 0, 0.35);
  color: #d9e8f7;
  transform: translate(-50%, calc(-100% - 14px));
  font-size: 11px;
  pointer-events: auto;
}
.map-feature-popup::after {
  position: absolute;
  bottom: -6px;
  left: 50%;
  width: 10px;
  height: 10px;
  border-right: 1px solid #3c6386;
  border-bottom: 1px solid #3c6386;
  background: #081423;
  content: "";
  transform: translateX(-50%) rotate(45deg);
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
.map-feature-popup-properties {
  display: grid;
  grid-template-columns: minmax(64px, 0.7fr) minmax(0, 1.3fr);
  gap: 5px 8px;
  margin: 0;
  padding-top: 8px;
  border-top: 1px solid #1e3853;
}
.map-feature-popup-properties dt,
.map-feature-popup-properties dd {
  min-width: 0;
  margin: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.map-feature-popup-properties dt {
  color: #7893ae;
}
.map-feature-popup-properties dd {
  color: #d7e5f3;
}
.map-feature-popup-more {
  margin: 8px 0 0;
  color: #7dd3fc;
  font-size: 10px;
}

/* 工作台布局：工具按需展开，地图始终保持完整可视区域。 */
.map-feature-popup-actions {
  display: flex;
  justify-content: flex-end;
  margin-top: 10px;
}
.map-feature-popup-delete {
  border: 1px solid rgba(248, 113, 113, 0.55);
  border-radius: 5px;
  padding: 4px 9px;
  background: rgba(127, 29, 29, 0.35);
  color: #fecaca;
  cursor: pointer;
  font-size: 11px;
}
.map-feature-popup-delete:hover {
  background: rgba(185, 28, 28, 0.55);
}
</style>
