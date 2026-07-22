<script setup lang="ts">
import {computed} from 'vue';
import {useMapStore} from '@/stores/map';
import type {TimeRange} from '@/types/gis';

const mapStore = useMapStore();
const bounds = computed(() => mapStore.timeBounds);
const pickerValue = computed(() => mapStore.timeRange ? [String(mapStore.timeRange.start), String(mapStore.timeRange.end)] : undefined);
const sliderValue = computed<number[]>({
  get() {
    if (!bounds.value) return [0, 100];
    const range = mapStore.timeRange ?? bounds.value;
    const span = Math.max(bounds.value.end - bounds.value.start, 1);
    return [((range.start - bounds.value.start) / span) * 100, ((range.end - bounds.value.start) / span) * 100];
  },
  set(value) {
    if (!bounds.value || value.length !== 2) return;
    const span = Math.max(bounds.value.end - bounds.value.start, 1);
    mapStore.setTimeRange({start: Math.round(bounds.value.start + span * value[0] / 100), end: Math.round(bounds.value.start + span * value[1] / 100)});
  },
});
const currentRangeLabel = computed(() => mapStore.timeRange ? formatRange(mapStore.timeRange) : '尚未选择筛选范围');

function updateEnabled(value: boolean | string | number) { mapStore.setTimeEnabled(Boolean(value)); }
function updatePicker(value: string[] | null) {
  if (!value || value.length !== 2) { mapStore.setTimeRange(undefined); return; }
  mapStore.setTimeRange({start: Number(value[0]), end: Number(value[1])});
}
function useFullRange() { if (bounds.value) mapStore.setTimeRange(bounds.value); }
function formatRange(range: TimeRange) { return `${new Date(range.start).toLocaleString()} 至 ${new Date(range.end).toLocaleString()}`; }
</script>

<template>
  <section class="panel timeline-panel">
    <div class="panel-title"><span>时间控制</span><el-switch :model-value="mapStore.timeEnabled" size="small" @change="updateEnabled" /></div>
    <div v-if="!bounds" class="empty-state feature-empty">配置图层的时间字段后<br /><small>这里会显示可筛选的时间范围</small></div>
    <template v-else>
      <div class="timeline-status">{{ mapStore.timeEnabled ? '时序过滤已启用' : '时序过滤未启用' }}</div>
      <el-date-picker :model-value="pickerValue" type="datetimerange" value-format="x" range-separator="至" start-placeholder="开始时间" end-placeholder="结束时间" :disabled="!mapStore.timeEnabled" @change="updatePicker" />
      <el-slider v-model="sliderValue" range :disabled="!mapStore.timeEnabled" :show-tooltip="false" />
      <div class="timeline-current">{{ currentRangeLabel }}</div>
      <button class="timeline-reset" :disabled="!mapStore.timeEnabled" @click="useFullRange">使用全部时间范围</button>
    </template>
  </section>
</template>
