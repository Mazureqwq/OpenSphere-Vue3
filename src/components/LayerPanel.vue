<script setup lang="ts">
import {useMapStore} from '@/stores/map';
const mapStore = useMapStore();
const emit = defineEmits<{remove: [id: string]}>();

function layerMeta(layer: {kind: string; featureCount?: number; realtime?: boolean}) {
  if (layer.realtime) return `实时轨迹 · ${layer.featureCount ?? 0} 个目标`;
  if (layer.kind === 'wms') return 'WMS 服务图层';
  if (layer.kind === 'vector') return `${layer.featureCount ?? 0} 个要素`;
  return '瓦片图层';
}
</script>

<template>
  <section class="panel layer-panel">
    <div class="panel-title"><span>图层</span><span class="count">{{ mapStore.dataLayers.length }}</span></div>
    <div v-if="!mapStore.dataLayers.length" class="empty-state">暂无业务图层<br /><small>导入 GeoJSON、CSV 或添加 WMS 服务</small></div>
    <div v-for="layer in mapStore.dataLayers" :key="layer.id" class="layer-row" :class="{selected: mapStore.selectedLayerId === layer.id}" @click="mapStore.selectedLayerId = layer.id">
      <el-checkbox :model-value="layer.visible" @change="(value: boolean | string | number) => mapStore.setLayerVisible(layer.id, Boolean(value))" @click.stop />
      <div class="layer-name"><strong>{{ layer.name }}</strong><small>{{ layerMeta(layer) }}</small></div>
      <button class="icon-button" title="移除图层" @click.stop="emit('remove', layer.id)">×</button>
    </div>
  </section>
</template>

