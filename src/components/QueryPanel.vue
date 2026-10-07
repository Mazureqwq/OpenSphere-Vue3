<script setup lang="ts">
import {computed, ref, toRaw, watch} from 'vue';
import type BaseLayer from 'ol/layer/Base';
import {ElMessage} from 'element-plus';
import {getCategoryFields} from '@/map/styles';
import {useMapStore} from '@/stores/map';
import type {FeatureQueryConfig, QueryOperator} from '@/types/gis';
import {formatDisplayValue, formatFieldLabel} from '@/ui/display';

const emit = defineEmits<{requestSpatial: []; focus: [layerId: string, featureId: string]}>();
const mapStore = useMapStore();
const vectorLayers = computed(() => mapStore.layers.filter((layer) => layer.vectorStyle));
const layerId = ref('');
const field = ref('');
const operator = ref<QueryOperator>('contains');
const value = ref('');
const activeLayer = computed(() => vectorLayers.value.find((layer) => layer.id === layerId.value));
const fields = computed(() => activeLayer.value ? getCategoryFields(toRaw(activeLayer.value.source) as unknown as BaseLayer) : []);

watch(() => mapStore.selectedLayerId, (selectedId) => {
  if (vectorLayers.value.some((layer) => layer.id === selectedId)) layerId.value = selectedId ?? '';
}, {immediate: true});
watch(() => mapStore.query, (query) => {
  if (!query) return;
  layerId.value = query.layerId; field.value = query.field; operator.value = query.operator; value.value = query.value;
}, {immediate: true, deep: true});
watch(layerId, () => { if (!fields.value.includes(field.value)) field.value = ''; });

function apply() {
  if (!layerId.value || !field.value || !value.value.trim()) { ElMessage.warning('请选择图层、字段并填写查询条件'); return; }
  const previousExtent = mapStore.query?.layerId === layerId.value ? mapStore.query.spatialExtent : undefined;
  mapStore.setQuery({layerId: layerId.value, field: field.value, operator: operator.value, value: value.value.trim(), spatialExtent: previousExtent});
}

function clear() { mapStore.setQuery(); value.value = ''; }
function requestSpatial() { if (!mapStore.query) { apply(); if (!mapStore.query) return; } emit('requestSpatial'); }
function clearSpatial() { if (mapStore.query) mapStore.setQuery({...mapStore.query, spatialExtent: undefined}); }
</script>

<template>
  <section class="panel query-panel">
    <div class="panel-title"><span>空间属性查询</span><button v-if="mapStore.query" class="clear-button" @click="clear">清除</button></div>
    <div v-if="!vectorLayers.length" class="empty-state feature-empty">导入矢量数据后<br /><small>可按属性和空间范围查询</small></div>
    <template v-else>
      <div class="query-grid">
        <el-select v-model="layerId" placeholder="选择图层"><el-option v-for="item in vectorLayers" :key="item.id" :label="item.name" :value="item.id" /></el-select>
        <el-select v-model="field" placeholder="选择字段"><el-option v-for="item in fields" :key="item" :label="formatFieldLabel(item)" :value="item" /></el-select>
        <el-select v-model="operator"><el-option label="包含" value="contains" /><el-option label="等于" value="equals" /><el-option label="大于" value="greaterThan" /><el-option label="小于" value="lessThan" /></el-select>
        <el-input v-model="value" placeholder="查询值" @keyup.enter="apply" />
      </div>
      <div class="query-actions"><el-button size="small" type="primary" @click="apply">查询</el-button><el-button size="small" :disabled="!mapStore.query" @click="requestSpatial">{{ mapStore.mapEngine === '3d' ? 'Shift 拖拽范围' : 'Shift 框选范围' }}</el-button><el-button v-if="mapStore.query?.spatialExtent" size="small" plain @click="clearSpatial">清除范围</el-button></div>
      <p v-if="mapStore.query?.spatialExtent" class="category-note">{{ mapStore.mapEngine === '3d' ? '按住 Shift 拖拽地表可重新框选' : '按住 Shift 拖拽地图可重新框选' }}</p>
      <div v-if="mapStore.query" class="query-results"><div class="query-result-title">匹配 {{ mapStore.queryResults.length }} 个要素</div><button v-for="result in mapStore.queryResults" :key="result.id" class="query-result" @click="emit('focus', result.layerId, result.id)"><strong>{{ formatDisplayValue(result.properties[mapStore.query?.field] || result.id) }}</strong><span>{{ result.id }}</span></button></div>
    </template>
  </section>
</template>



<style scoped>
.query-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 8px;
  margin-top: 13px;
}
.query-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 7px;
  margin-top: 9px;
}
.query-actions :deep(.el-button) {
  margin: 0;
}
.query-results {
  max-height: 200px;
  margin-top: 12px;
  overflow: auto;
  border-top: 1px solid #1e3853;
}
.query-result-title {
  padding: 8px 0;
  color: #7dd3fc;
  font-size: 11px;
}
.query-result {
  display: flex;
  width: 100%;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  padding: 8px 0;
  border: 0;
  border-top: 1px solid #1a3049;
  color: #d7e5f3;
  background: transparent;
  text-align: left;
  cursor: pointer;
}
.query-result:hover {
  color: #5eead4;
}
.query-result strong,
.query-result span {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: 11px;
}
.query-result strong {
  flex: 1;
}
.query-result span {
  max-width: 90px;
  color: #6986a2;
  font-family: Consolas, monospace;
  font-size: 9px;
}
</style>
