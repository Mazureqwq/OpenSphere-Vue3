<script setup lang="ts">
import {computed, ref} from "vue";
import {Plus} from "@element-plus/icons-vue";
import {useMapStore} from "@/stores/map";

const emit = defineEmits<{
  create: [];
  remove: [id: string];
  edit: [id: string];
  export: [id: string];
  baseMap: [];
}>();
const mapStore = useMapStore();
const layerSearch = ref("");
const layerOrder = ref<"zOrder" | "name">("zOrder");
const filteredLayers = computed(() => {
  const term = layerSearch.value.trim().toLocaleLowerCase();
  const layers = mapStore.dataLayers.filter((layer) => !term || layer.name.toLocaleLowerCase().includes(term));
  return layerOrder.value === "name" ? [...layers].sort((left, right) => left.name.localeCompare(right.name, "zh-CN")) : layers;
});
function layerMeta(layer: {kind: string; featureCount?: number; realtime?: boolean}) {
  if (layer.realtime) return `实时轨迹 · ${layer.featureCount ?? 0} 个目标`;
  if (layer.kind === "wms") return "WMS 服务图层";
  return `${layer.featureCount ?? 0} 个要素`;
}
function selectBaseMap(id: string) {
  mapStore.setBaseMap(id);
  emit("baseMap");
}
</script>

<template>
  <div class="workspace-tab-content">
    <div class="workspace-control-row"><span>排序</span><div class="workspace-layer-actions"><el-select v-model="layerOrder" size="small"><el-option label="添加顺序" value="zOrder" /><el-option label="名称" value="name" /></el-select><el-button size="small" type="primary" :icon="Plus" @click="emit('create')">新建图层</el-button></div></div>
    <el-input v-model="layerSearch" size="small" placeholder="搜索活动图层" clearable />
    <div class="workspace-tree"><strong class="workspace-group-title">业务图层 ({{ filteredLayers.length }})</strong><div v-if="!filteredLayers.length" class="workspace-empty">暂无匹配图层</div><button v-for="layer in filteredLayers" :key="layer.id" class="workspace-layer-row" :class="{selected: mapStore.selectedLayerId === layer.id}" @click="mapStore.selectedLayerId = layer.id"><el-checkbox :model-value="layer.visible" @change="(value: boolean | string | number) => mapStore.setLayerVisible(layer.id, Boolean(value))" @click.stop /><span><strong>{{ layer.name }}</strong><small>{{ layerMeta(layer) }}</small></span><i v-if="layer.kind === 'vector' && !layer.realtime" title="编辑图层" @click.stop="emit('edit', layer.id)">✎</i><i v-if="layer.kind === 'vector' && !layer.realtime" title="导出图层" @click.stop="emit('export', layer.id)">↓</i><i title="移除图层" @click.stop="emit('remove', layer.id)">×</i></button><strong class="workspace-group-title">底图</strong><button v-for="baseMap in mapStore.baseMaps" :key="baseMap.id" class="workspace-layer-row" :class="{selected: mapStore.activeBaseMapId === baseMap.id}" @click="selectBaseMap(baseMap.id)"><el-checkbox :model-value="mapStore.activeBaseMapId === baseMap.id" @click.stop="selectBaseMap(baseMap.id)" /><span><strong>{{ baseMap.name }}</strong><small>{{ baseMap.region === 'china' ? '国内服务' : '全球服务' }}</small></span></button></div>
  </div>
</template>