<script setup lang="ts">
import {computed, ref} from 'vue';
import {ElMessage} from 'element-plus';
import {convertCoordinate, type CoordinateSystem, type GeographicCoordinate} from '@/map/coordinateTransform';

const emit = defineEmits<{locate: [coordinate: GeographicCoordinate]}>();
const longitude = ref('113.6254');
const latitude = ref('34.7466');
const source = ref<CoordinateSystem>('WGS84');
const target = ref<CoordinateSystem>('GCJ02');
const result = ref<GeographicCoordinate>();
const systems: Array<{value: CoordinateSystem; label: string}> = [{value: 'WGS84', label: 'WGS84（GPS）'}, {value: 'GCJ02', label: 'GCJ-02（高德 / 腾讯）'}, {value: 'BD09', label: 'BD-09（百度）'}];
const resultLabel = computed(() => result.value ? `${result.value[0].toFixed(6)}, ${result.value[1].toFixed(6)}` : '尚未转换');

function getInput(): GeographicCoordinate | undefined {
  const coordinate: GeographicCoordinate = [Number(longitude.value), Number(latitude.value)];
  if (!Number.isFinite(coordinate[0]) || !Number.isFinite(coordinate[1])) { ElMessage.warning('请输入有效的经度和纬度'); return undefined; }
  return coordinate;
}
function convert() {
  const coordinate = getInput();
  if (!coordinate) return;
  try { result.value = convertCoordinate(coordinate, source.value, target.value); }
  catch (error) { ElMessage.error(error instanceof Error ? error.message : '坐标转换失败'); }
}
function locate() {
  const coordinate = getInput();
  if (!coordinate) return;
  try {
    result.value = convertCoordinate(coordinate, source.value, target.value);
    emit('locate', convertCoordinate(coordinate, source.value, 'WGS84'));
  } catch (error) { ElMessage.error(error instanceof Error ? error.message : '坐标定位失败'); }
}
function swap() { const previous = source.value; source.value = target.value; target.value = previous; convert(); }
</script>

<template>
  <section class="panel coordinate-panel">
    <div class="panel-title"><span>坐标定位与转换</span><button class="clear-button" @click="swap">交换坐标系</button></div>
    <div class="coordinate-inputs"><el-input v-model="longitude" size="small" placeholder="经度，例如 113.6254" /><el-input v-model="latitude" size="small" placeholder="纬度，例如 34.7466" /></div>
    <div class="coordinate-systems"><el-select v-model="source" size="small"><el-option v-for="system in systems" :key="system.value" :label="system.label" :value="system.value" /></el-select><span>→</span><el-select v-model="target" size="small"><el-option v-for="system in systems" :key="system.value" :label="system.label" :value="system.value" /></el-select></div>
    <div class="coordinate-actions"><el-button size="small" plain @click="convert">转换</el-button><el-button size="small" type="primary" @click="locate">定位到地图</el-button></div>
    <div class="coordinate-result"><span>{{ target }} 结果</span><strong>{{ resultLabel }}</strong></div>
    <p class="coordinate-note">按经度、纬度顺序输入；境外坐标转换时保持原值。</p>
  </section>
</template>



<style scoped>
.coordinate-inputs,
.coordinate-systems {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 8px;
  margin-top: 12px;
}
.coordinate-systems {
  grid-template-columns: minmax(0, 1fr) 16px minmax(0, 1fr);
  align-items: center;
  margin-top: 8px;
}
.coordinate-systems > span {
  color: #6f8ba6;
  text-align: center;
}
.coordinate-actions {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 8px;
  margin-top: 10px;
}
.coordinate-actions :deep(.el-button) {
  margin: 0;
}
.coordinate-result {
  display: grid;
  gap: 4px;
  margin-top: 10px;
  padding-top: 9px;
  border-top: 1px solid #1e3853;
  color: #7893ae;
  font-size: 10px;
}
.coordinate-result strong {
  overflow: hidden;
  color: #d9e8f7;
  font-family: Consolas, monospace;
  font-size: 11px;
  font-weight: 500;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.coordinate-note {
  margin: 9px 0 0;
  color: #7189a3;
  font-size: 10px;
  line-height: 1.55;
}
</style>
