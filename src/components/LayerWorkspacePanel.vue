<script setup lang="ts">
import {computed, ref, watch} from 'vue';
import {Download, FolderAdd, Plus, Upload} from '@element-plus/icons-vue';
import {ElMessage, ElMessageBox} from 'element-plus';
import {useMapStore} from '@/stores/map';
import type {MapViewState} from '@/types/workspace';
import {loadWorkspaceLibrary, saveWorkspaceLibrary, type SavedArea, type SavedFilter, type SavedPlace, type WorkspaceLibrary} from '@/workspaceLibrary';

const props = defineProps<{view: MapViewState}>();
const emit = defineEmits<{remove: [id: string]; locate: [coordinate: [number, number]]; requestSpatial: []; openQuery: []; baseMap: []}>();
const mapStore = useMapStore();
const activeTab = ref<'layers' | 'areas' | 'filters' | 'places'>('layers');
const layerSearch = ref('');
const areaSearch = ref('');
const filterSearch = ref('');
const placeSearch = ref('');
const placeFolder = ref('');
const layerOrder = ref<'zOrder' | 'name'>('zOrder');
const library = ref<WorkspaceLibrary>(loadWorkspaceLibrary());
const importInput = ref<HTMLInputElement>();
const importKind = ref<'areas' | 'filters' | 'places'>('places');

watch(library, (value) => saveWorkspaceLibrary(value), {deep: true});

const filteredLayers = computed(() => {
  const term = layerSearch.value.trim().toLocaleLowerCase();
  const layers = mapStore.dataLayers.filter((layer) => !term || layer.name.toLocaleLowerCase().includes(term));
  return layerOrder.value === 'name' ? [...layers].sort((left, right) => left.name.localeCompare(right.name, 'zh-CN')) : layers;
});
const filteredAreas = computed(() => filterByName(library.value.areas, areaSearch.value));
const filteredFilters = computed(() => filterByName(library.value.filters, filterSearch.value));
const filteredPlaces = computed(() => filterByName(library.value.places, placeSearch.value));

function filterByName<T extends {name: string}>(items: T[], term: string) {
  const keyword = term.trim().toLocaleLowerCase();
  return keyword ? items.filter((item) => item.name.toLocaleLowerCase().includes(keyword)) : items;
}
function placesInFolder(folder?: string) { return filteredPlaces.value.filter((place) => (place.folder ?? '') === (folder ?? '')); }
function layerMeta(layer: {kind: string; featureCount?: number; realtime?: boolean}) {
  if (layer.realtime) return `实时轨迹 · ${layer.featureCount ?? 0} 个目标`;
  if (layer.kind === 'wms') return 'WMS 服务图层';
  return `${layer.featureCount ?? 0} 个要素`;
}
function selectBaseMap(id: string) { mapStore.setBaseMap(id); emit('baseMap'); }
function createId(prefix: string) { return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`; }
async function promptName(title: string, value: string) {
  try { return (await ElMessageBox.prompt('请输入名称', title, {inputValue: value, confirmButtonText: '确定', cancelButtonText: '取消', inputPattern: /\S/, inputErrorMessage: '名称不能为空'})).value.trim(); }
  catch { return undefined; }
}
async function saveArea() {
  const extent = mapStore.query?.spatialExtent;
  if (!extent) { ElMessage.warning('请先在空间查询中框选范围'); emit('openQuery'); return; }
  const name = await promptName('保存范围', `范围 ${library.value.areas.length + 1}`);
  if (!name) return;
  library.value.areas.unshift({id: createId('area'), name, extent: [...extent] as [number, number, number, number], savedAt: new Date().toISOString()});
}
function applyArea(area: SavedArea) {
  if (!mapStore.query) { ElMessage.info('请先设置属性查询条件，再应用保存范围'); emit('openQuery'); return; }
  mapStore.setQueryExtent(area.extent);
  ElMessage.success(`已应用范围：${area.name}`);
}
async function saveFilter() {
  if (!mapStore.query) { ElMessage.warning('请先设置属性查询条件'); emit('openQuery'); return; }
  const name = await promptName('保存筛选', `筛选 ${library.value.filters.length + 1}`);
  if (!name) return;
  library.value.filters.unshift({id: createId('filter'), name, query: {...mapStore.query}, savedAt: new Date().toISOString()});
}
function applyFilter(filter: SavedFilter) {
  if (!mapStore.layers.some((layer) => layer.id === filter.query.layerId)) { ElMessage.warning('筛选关联的图层当前不存在'); return; }
  mapStore.setQuery({...filter.query});
  ElMessage.success(`已应用筛选：${filter.name}`);
}
async function addFolder() {
  const name = await promptName('新建收藏夹', '');
  if (!name || library.value.folders.includes(name)) return;
  library.value.folders.push(name);
}
async function addPlace() {
  const name = await promptName('保存地点', `地点 ${library.value.places.length + 1}`);
  if (!name) return;
  library.value.places.unshift({id: createId('place'), name, coordinate: [...props.view.center] as [number, number], folder: placeFolder.value || undefined, savedAt: new Date().toISOString()});
}
function removeItem(kind: 'areas' | 'filters' | 'places', id: string) { library.value[kind] = library.value[kind].filter((item) => item.id !== id) as never; }
function exportItems(kind: 'areas' | 'filters' | 'places') {
  const blob = new Blob([JSON.stringify({version: 1, kind, items: library.value[kind]}, null, 2)], {type: 'application/json'});
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = `opensphere-${kind}.json`;
  link.click();
  URL.revokeObjectURL(link.href);
}
function chooseImport(kind: 'areas' | 'filters' | 'places') { importKind.value = kind; importInput.value?.click(); }
async function importItems(event: Event) {
  const input = event.target as HTMLInputElement;
  const file = input.files?.[0];
  input.value = '';
  if (!file) return;
  try {
    const payload = JSON.parse(await file.text()) as {kind?: string; items?: unknown};
    if (payload.kind !== importKind.value || !Array.isArray(payload.items)) throw new Error('文件类型不匹配');
    const items = payload.items as Array<SavedArea | SavedFilter | SavedPlace>;
    library.value[importKind.value] = [...library.value[importKind.value], ...items.map((item) => ({...item, id: createId(importKind.value.slice(0, -1))}))] as never;
    ElMessage.success(`已导入 ${items.length} 项`);
  } catch (error) { ElMessage.error(error instanceof Error ? error.message : '导入失败'); }
}
</script>

<template>
  <section class="panel layer-workspace-panel">
    <el-tabs v-model="activeTab" class="workspace-tabs">
      <el-tab-pane label="图层" name="layers">
        <div class="workspace-control-row"><span>排序</span><el-select v-model="layerOrder" size="small"><el-option label="添加顺序" value="zOrder" /><el-option label="名称" value="name" /></el-select></div>
        <el-input v-model="layerSearch" size="small" placeholder="搜索活动图层" clearable />
        <div class="workspace-tree"><strong class="workspace-group-title">业务图层 ({{ filteredLayers.length }})</strong><div v-if="!filteredLayers.length" class="workspace-empty">暂无匹配图层</div><button v-for="layer in filteredLayers" :key="layer.id" class="workspace-layer-row" :class="{selected: mapStore.selectedLayerId === layer.id}" @click="mapStore.selectedLayerId = layer.id"><el-checkbox :model-value="layer.visible" @change="(value: boolean | string | number) => mapStore.setLayerVisible(layer.id, Boolean(value))" @click.stop /><span><strong>{{ layer.name }}</strong><small>{{ layerMeta(layer) }}</small></span><i title="移除图层" @click.stop="emit('remove', layer.id)">×</i></button><strong class="workspace-group-title">底图</strong><button v-for="baseMap in mapStore.baseMaps" :key="baseMap.id" class="workspace-layer-row" :class="{selected: mapStore.activeBaseMapId === baseMap.id}" @click="selectBaseMap(baseMap.id)"><el-checkbox :model-value="mapStore.activeBaseMapId === baseMap.id" @click.stop="selectBaseMap(baseMap.id)" /><span><strong>{{ baseMap.name }}</strong><small>{{ baseMap.region === 'china' ? '国内服务' : '全球服务' }}</small></span></button></div>
      </el-tab-pane>
      <el-tab-pane label="范围" name="areas">
        <div class="workspace-control-row"><span>保存的范围</span><el-button size="small" type="primary" :icon="Plus" @click="saveArea">保存当前范围</el-button></div><el-input v-model="areaSearch" size="small" placeholder="搜索范围" clearable /><div class="workspace-tree"><div v-if="!filteredAreas.length" class="workspace-empty">暂无保存范围</div><button v-for="area in filteredAreas" :key="area.id" class="workspace-saved-row" @click="applyArea(area)"><span><strong>{{ area.name }}</strong><small>{{ area.extent.map((value) => value.toFixed(3)).join(', ') }}</small></span><i title="删除范围" @click.stop="removeItem('areas', area.id)">×</i></button></div><div class="workspace-actions"><el-button size="small" :icon="Download" @click="exportItems('areas')">导出</el-button><el-button size="small" :icon="Upload" @click="chooseImport('areas')">导入</el-button><el-button size="small" type="primary" @click="emit('requestSpatial')">框选范围</el-button></div>
      </el-tab-pane>
      <el-tab-pane label="筛选" name="filters">
        <div class="workspace-control-row"><span>保存的筛选</span><el-button size="small" type="primary" :icon="Plus" @click="saveFilter">保存当前筛选</el-button></div><el-input v-model="filterSearch" size="small" placeholder="搜索筛选" clearable /><div class="workspace-tree"><div v-if="!filteredFilters.length" class="workspace-empty">暂无保存筛选</div><button v-for="filter in filteredFilters" :key="filter.id" class="workspace-saved-row" @click="applyFilter(filter)"><span><strong>{{ filter.name }}</strong><small>{{ filter.query.field }} · {{ filter.query.value }}</small></span><i title="删除筛选" @click.stop="removeItem('filters', filter.id)">×</i></button></div><div class="workspace-actions"><el-button size="small" :icon="Download" @click="exportItems('filters')">导出</el-button><el-button size="small" :icon="Upload" @click="chooseImport('filters')">导入</el-button><el-button size="small" type="primary" @click="emit('openQuery')">高级查询</el-button></div>
      </el-tab-pane>
      <el-tab-pane label="地点" name="places">
        <div class="workspace-control-row"><el-button size="small" type="primary" :icon="Plus" @click="addPlace">添加地点</el-button><el-button size="small" :icon="FolderAdd" @click="addFolder">新建收藏夹</el-button></div><el-select v-model="placeFolder" size="small" placeholder="选择收藏夹（可选）" clearable><el-option v-for="folder in library.folders" :key="folder" :label="folder" :value="folder" /></el-select><el-input v-model="placeSearch" size="small" placeholder="搜索收藏地点" clearable /><div class="workspace-tree"><template v-for="folder in library.folders" :key="folder"><strong class="workspace-folder">▾ {{ folder }}</strong><button v-for="place in placesInFolder(folder)" :key="place.id" class="workspace-saved-row" @click="emit('locate', place.coordinate)"><span><strong>{{ place.name }}</strong><small>{{ place.coordinate[0].toFixed(5) }}, {{ place.coordinate[1].toFixed(5) }}</small></span><i title="删除地点" @click.stop="removeItem('places', place.id)">×</i></button></template><strong v-if="placesInFolder().length" class="workspace-folder">▾ 未分类</strong><button v-for="place in placesInFolder()" :key="place.id" class="workspace-saved-row" @click="emit('locate', place.coordinate)"><span><strong>{{ place.name }}</strong><small>{{ place.coordinate[0].toFixed(5) }}, {{ place.coordinate[1].toFixed(5) }}</small></span><i title="删除地点" @click.stop="removeItem('places', place.id)">×</i></button><div v-if="!filteredPlaces.length" class="workspace-empty">暂无收藏地点</div></div><div class="workspace-actions"><el-button size="small" :icon="Download" @click="exportItems('places')">导出</el-button><el-button size="small" :icon="Upload" @click="chooseImport('places')">导入</el-button></div>
      </el-tab-pane>
    </el-tabs>
    <input ref="importInput" class="workspace-file-input" type="file" accept="application/json,.json" @change="importItems" />
  </section>
</template>
