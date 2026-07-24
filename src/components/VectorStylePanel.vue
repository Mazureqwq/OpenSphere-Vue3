<script setup lang="ts">
import {computed, reactive, watch} from 'vue';
import {useMapStore} from '@/stores/map';
import type {VectorStyleConfig} from '@/types/gis';

const mapStore = useMapStore();
const layer = computed(() => mapStore.layers.find((item) => item.id === mapStore.selectedLayerId));
const style = reactive<VectorStyleConfig>({pointColor: '#14b8a6', pointRadius: 5, strokeColor: '#2dd4bf', strokeWidth: 2, lineDash: 'solid', fillColor: '#2dd4bf', fillOpacity: 0.24});

watch(layer, (selectedLayer) => {
  if (!selectedLayer?.vectorStyle) return;
  Object.assign(style, selectedLayer.vectorStyle);
}, {immediate: true});

function apply() {
  if (!layer.value?.vectorStyle) return;
  mapStore.setVectorStyle(layer.value.id, {...style});
}
</script>

<template>
  <section class="panel style-panel">
    <div class="panel-title"><span>矢量样式</span><span v-if="layer?.vectorStyle" class="style-badge">{{ layer.name }}</span></div>
    <div v-if="!layer?.vectorStyle" class="empty-state feature-empty">选择一个矢量图层<br /><small>可编辑点、线、面显示样式</small></div>
    <template v-else>
      <div class="style-grid">
        <label>点颜色<el-color-picker v-model="style.pointColor" @change="apply" /></label>
        <label>点大小<el-input-number v-model="style.pointRadius" :min="2" :max="24" :step="1" controls-position="right" @change="apply" /></label>
        <label>边框颜色<el-color-picker v-model="style.strokeColor" @change="apply" /></label>
        <label>边框宽度<el-input-number v-model="style.strokeWidth" :min="1" :max="16" :step="1" controls-position="right" @change="apply" /></label>
        <label>填充颜色<el-color-picker v-model="style.fillColor" @change="apply" /></label>
        <label>填充透明度<el-slider v-model="style.fillOpacity" :min="0" :max="1" :step="0.02" :show-tooltip="false" @input="apply" /></label>
      </div>
      <label class="style-line-type">线型<el-select v-model="style.lineDash" @change="apply"><el-option label="实线" value="solid" /><el-option label="虚线" value="dashed" /><el-option label="点线" value="dotted" /></el-select></label>
      <div class="layer-opacity"><span>图层透明度</span><el-slider :model-value="layer.opacity" :min="0.1" :max="1" :step="0.05" :show-tooltip="false" @input="(value: number) => mapStore.setLayerOpacity(layer!.id, value)" /></div>
    </template>
  </section>
</template>
