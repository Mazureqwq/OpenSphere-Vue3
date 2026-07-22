<script setup lang="ts">
import {computed, ref, toRaw, watch} from 'vue';
import type BaseLayer from 'ol/layer/Base';
import {ElMessage} from 'element-plus';
import {getTimeFields} from '@/map/styles';
import {useMapStore} from '@/stores/map';
import {formatFieldLabel} from '@/ui/display';

const mapStore = useMapStore();
const layer = computed(() => mapStore.layers.find((item) => item.id === mapStore.selectedLayerId));
const field = ref('');
const fields = computed(() => layer.value?.vectorStyle ? getTimeFields(toRaw(layer.value.source) as unknown as BaseLayer) : []);

watch(layer, (selectedLayer) => { field.value = selectedLayer?.timeFilter?.field ?? ''; }, {immediate: true});

function apply() {
  if (!layer.value?.vectorStyle || !field.value) { ElMessage.warning('请选择包含日期或时间戳的属性字段'); return; }
  mapStore.setTimeFilter(layer.value.id, {field: field.value});
  if (!mapStore.timeRange && mapStore.timeBounds) mapStore.setTimeRange(mapStore.timeBounds);
}

function clear() {
  if (!layer.value?.vectorStyle) return;
  mapStore.clearTimeFilter(layer.value.id);
  field.value = '';
}
</script>

<template>
  <section class="panel time-field-panel">
    <div class="panel-title"><span>时间字段</span><button v-if="layer?.timeFilter" class="clear-button" @click="clear">取消</button></div>
    <div v-if="!layer?.vectorStyle" class="empty-state feature-empty">选择一个矢量图层<br /><small>配置用于时间筛选的字段</small></div>
    <template v-else>
      <div class="category-actions"><el-select v-model="field" placeholder="选择时间字段" @change="apply"><el-option v-for="item in fields" :key="item" :label="formatFieldLabel(item)" :value="item" /></el-select><el-button type="primary" :disabled="!field" @click="apply">应用</el-button></div>
      <p v-if="!fields.length" class="category-note">未识别到日期、ISO 时间或 Unix 时间戳字段。</p>
      <p v-else class="category-note">支持 ISO 日期、常见日期字符串、秒级和毫秒级 Unix 时间戳。</p>
    </template>
  </section>
</template>
