<script setup lang="ts">
import {computed, reactive, ref, watch} from 'vue';
import {useMapStore} from '@/stores/map';
import type {PointVisualizationConfig, PointVisualizationMode} from '@/types/gis';

const emit = defineEmits<{apply: [layerId: string, config: PointVisualizationConfig]; clear: []}>();
const mapStore = useMapStore();
const eligibleLayers = computed(() => mapStore.layers.filter((layer) => Boolean(layer.vectorStyle)));
const sourceLayerId = ref('');
const config = reactive<PointVisualizationConfig>({mode: 'heatmap', heatRadius: 18, heatBlur: 14, clusterDistance: 40});

watch([eligibleLayers, () => mapStore.selectedLayerId], () => {
  const selected = mapStore.layers.find((layer) => layer.id === mapStore.selectedLayerId && layer.vectorStyle);
  if (selected) sourceLayerId.value = selected.id;
  else if (!eligibleLayers.value.some((layer) => layer.id === sourceLayerId.value)) sourceLayerId.value = eligibleLayers.value[0]?.id ?? '';
}, {immediate: true});

function apply() {
  if (!sourceLayerId.value) return;
  emit('apply', sourceLayerId.value, {...config});
}
function setMode(mode: PointVisualizationMode) { config.mode = mode; }
</script>

<template>
  <section class="panel point-visualization-panel">
    <div class="panel-title"><span>点位展示</span><span class="style-badge">热力 / 聚合</span></div>
    <div v-if="!eligibleLayers.length" class="empty-state feature-empty">暂无可用点位图层<br /><small>请先导入包含点要素的数据</small></div>
    <template v-else>
      <el-select v-model="sourceLayerId" size="small" placeholder="选择点位图层"><el-option v-for="layer in eligibleLayers" :key="layer.id" :label="layer.name" :value="layer.id" /></el-select>
      <div class="visualization-modes"><el-button :type="config.mode === 'heatmap' ? 'primary' : 'default'" size="small" @click="setMode('heatmap')">热力图</el-button><el-button :type="config.mode === 'cluster' ? 'primary' : 'default'" size="small" @click="setMode('cluster')">聚合气泡</el-button></div>
      <div v-if="config.mode === 'heatmap'" class="visualization-controls"><label>热力半径<el-slider v-model="config.heatRadius" :min="8" :max="48" :step="1" :show-tooltip="false" /></label><label>模糊范围<el-slider v-model="config.heatBlur" :min="4" :max="36" :step="1" :show-tooltip="false" /></label></div>
      <div v-else class="visualization-controls"><label>聚合距离<el-slider v-model="config.clusterDistance" :min="12" :max="120" :step="2" :show-tooltip="false" /></label><p>点击气泡可放大展开；仅含一个点时会显示该点属性。</p></div>
      <div class="visualization-actions"><el-button size="small" type="primary" @click="apply">应用展示</el-button><el-button size="small" plain @click="emit('clear')">恢复原始点位</el-button></div>
    </template>
  </section>
</template>
