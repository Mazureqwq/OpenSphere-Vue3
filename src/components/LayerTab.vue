<script setup lang="ts">
import { computed, ref } from 'vue';
import { Plus } from '@element-plus/icons-vue';
import { useMapStore } from '@/stores/map';
import { useSelectionStore } from '@/stores/selection';

const props = withDefaults(defineProps<{ dataMode?: boolean }>(), { dataMode: false });
const emit = defineEmits<{
  create: [];
  remove: [id: string];
  edit: [id: string];
  export: [id: string];
  import: [files: FileList | null];
  openWms: [];
  baseMap: [];
}>();
const mapStore = useMapStore();
const selection = useSelectionStore();
const layerSearch = ref('');
const layerOrder = ref<'zOrder' | 'name'>('zOrder');
const filteredLayers = computed(() => {
  const term = layerSearch.value.trim().toLocaleLowerCase();
  const layers = mapStore.dataLayers.filter((layer) => !term || layer.name.toLocaleLowerCase().includes(term));
  return layerOrder.value === 'name' ? [...layers].sort((left, right) => left.name.localeCompare(right.name, 'zh-CN')) : layers;
});
function layerMeta(layer: { kind: string; featureCount?: number; realtime?: boolean }) {
  if (layer.realtime) return `实时轨迹 · ${layer.featureCount ?? 0} 个目标`;
  if (layer.kind === 'wms') return 'WMS 服务图层';
  return `${layer.featureCount ?? 0} 个要素`;
}
function layerSource(layer: { kind: string; realtime?: boolean }) {
  if (layer.realtime) return '实时服务';
  if (layer.kind === 'wms') return 'WMS';
  if (layer.kind === 'drawing') return '绘制';
  return '本地';
}
/** 替换式选中：再点同一图层取消选中；选中图层会清除要素选中。 */
function selectLayer(id: string) {
  if (mapStore.selectedLayerId === id && !mapStore.selectedFeature) selection.clear();
  else selection.select({ kind: 'layer', layerId: id });
}
function selectBaseMap(id: string) {
  mapStore.setBaseMap(id);
  emit('baseMap');
}
function importFiles(event: Event) {
  const input = event.target as HTMLInputElement;
  emit('import', input.files);
  input.value = '';
}
</script>

<template>
  <div class="workspace-tab-content" :class="{ 'is-data-mode': props.dataMode }">
    <section v-if="props.dataMode" class="data-catalog-summary" aria-label="数据资产操作">
      <div>
        <p>数据资产</p>
        <strong>{{ filteredLayers.length }} 个数据源</strong>
      </div>
      <div class="data-catalog-actions">
        <label class="data-import-action">导入文件<input class="workspace-file-input" type="file" accept=".geojson,.json,.csv,.kml,.kmz,.gpx,.zip" multiple @change="importFiles" /></label>
        <button type="button" class="data-wms-action" @click="emit('openWms')">连接 WMS</button>
      </div>
      <p class="data-catalog-note">支持 GeoJSON / CSV / KML / GPX / ZIP 与 WMS 服务</p>
    </section>

    <div class="workspace-control-row">
      <span>排序</span>
      <div class="workspace-layer-actions">
        <el-select v-model="layerOrder" size="small" aria-label="图层排序"><el-option label="添加顺序" value="zOrder" /><el-option label="名称" value="name" /></el-select>
        <el-button size="small" type="primary" :icon="Plus" @click="emit('create')">新建图层</el-button>
      </div>
    </div>
    <el-input v-model="layerSearch" size="small" placeholder="搜索图层" clearable />
    <div class="workspace-tree">
      <strong class="workspace-group-title">{{ props.dataMode ? '已连接数据源' : '业务图层' }} ({{ filteredLayers.length }})</strong>
      <div v-if="!filteredLayers.length" class="workspace-empty">暂无匹配图层</div>
      <div v-for="layer in filteredLayers" :key="layer.id" class="workspace-layer-row" :class="{ selected: mapStore.selectedLayerId === layer.id }">
        <el-checkbox :model-value="layer.visible" :aria-label="`${layer.name} 可见性`" @change="(value: boolean | string | number) => mapStore.setLayerVisible(layer.id, Boolean(value))" />
        <button type="button" class="workspace-layer-select" :aria-pressed="mapStore.selectedLayerId === layer.id" @click="selectLayer(layer.id)">
          <span><strong>{{ layer.name }}</strong><small>{{ props.dataMode ? `${layerSource(layer)} · ${layerMeta(layer)}` : layerMeta(layer) }}</small></span>
        </button>
        <div class="workspace-row-actions">
          <button v-if="layer.kind === 'vector' && !layer.realtime" type="button" class="workspace-row-action" :aria-label="`编辑图层 ${layer.name}`" title="编辑图层" @click="emit('edit', layer.id)">✎</button>
          <button v-if="layer.kind === 'vector' && !layer.realtime" type="button" class="workspace-row-action" :aria-label="`导出图层 ${layer.name}`" title="导出图层" @click="emit('export', layer.id)">↓</button>
          <button type="button" class="workspace-row-action workspace-row-action--danger" :aria-label="`移除图层 ${layer.name}`" title="移除图层" @click="emit('remove', layer.id)">×</button>
        </div>
      </div>
      <template v-if="!props.dataMode">
        <strong class="workspace-group-title workspace-group-title--basemap">底图</strong>
        <div v-for="baseMap in mapStore.baseMaps" :key="baseMap.id" class="workspace-layer-row" :class="{ selected: mapStore.activeBaseMapId === baseMap.id }">
          <el-checkbox :model-value="mapStore.activeBaseMapId === baseMap.id" :aria-label="`${baseMap.name} 已选中`" @change="selectBaseMap(baseMap.id)" />
          <button type="button" class="workspace-layer-select" :aria-pressed="mapStore.activeBaseMapId === baseMap.id" @click="selectBaseMap(baseMap.id)">
            <span><strong>{{ baseMap.name }}</strong><small>{{ baseMap.region === 'china' ? '国内服务' : '全球服务' }}</small></span>
          </button>
        </div>
      </template>
    </div>
  </div>
</template>
