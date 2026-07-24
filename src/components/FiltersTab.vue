<script setup lang="ts">
import {computed, ref} from "vue";
import {Download, Plus, Upload} from "@element-plus/icons-vue";
import {ElMessage, ElMessageBox} from "element-plus";
import {useMapStore} from "@/stores/map";
import type {SavedFilter, WorkspaceLibrary} from "@/workspaceLibrary";

const props = defineProps<{library: WorkspaceLibrary}>();
const emit = defineEmits<{openQuery: []}>();
const mapStore = useMapStore();
const filterSearch = ref("");
const importInput = ref<HTMLInputElement>();
const filteredFilters = computed(() => filterByName(props.library.filters, filterSearch.value));
function filterByName<T extends {name: string}>(items: T[], term: string) { const keyword = term.trim().toLocaleLowerCase(); return keyword ? items.filter((item) => item.name.toLocaleLowerCase().includes(keyword)) : items; }
function createId(prefix: string) { return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`; }
async function promptName(title: string, value: string) { try { return (await ElMessageBox.prompt("请输入名称", title, {inputValue: value, confirmButtonText: "确定", cancelButtonText: "取消", inputPattern: /\S/, inputErrorMessage: "名称不能为空"})).value.trim(); } catch { return undefined; } }
async function saveFilter() { if (!mapStore.query) { ElMessage.warning("请先设置属性查询条件"); emit("openQuery"); return; } const name = await promptName("保存筛选", `筛选 ${props.library.filters.length + 1}`); if (!name) return; props.library.filters.unshift({id: createId("filter"), name, query: {...mapStore.query}, savedAt: new Date().toISOString()}); }
function applyFilter(filter: SavedFilter) { if (!mapStore.layers.some((layer) => layer.id === filter.query.layerId)) { ElMessage.warning("筛选关联的图层当前不存在"); return; } mapStore.setQuery({...filter.query}); ElMessage.success(`已应用筛选：${filter.name}`); }
function removeItem(id: string) { props.library.filters = props.library.filters.filter((item) => item.id !== id); }
function chooseImport() { importInput.value?.click(); }
async function importItems(event: Event) { const input = event.target as HTMLInputElement; const file = input.files?.[0]; input.value = ""; if (!file) return; try { const payload = JSON.parse(await file.text()) as {kind?: string; items?: unknown}; if (payload.kind !== "filters" || !Array.isArray(payload.items)) throw new Error("文件类型不匹配"); const items = payload.items as Array<SavedFilter>; props.library.filters = [...props.library.filters, ...items.map((item) => ({...item, id: createId("filter")}))]; ElMessage.success(`已导入 ${items.length} 项`); } catch (error) { ElMessage.error(error instanceof Error ? error.message : "导入失败"); } }
function exportItems() { const blob = new Blob([JSON.stringify({version: 1, kind: "filters", items: props.library.filters}, null, 2)], {type: "application/json"}); const link = document.createElement("a"); link.href = URL.createObjectURL(blob); link.download = "opensphere-filters.json"; link.click(); URL.revokeObjectURL(link.href); }
</script>

<template>
  <div class="workspace-tab-content">
    <div class="workspace-control-row"><span>保存的筛选</span><el-button size="small" type="primary" :icon="Plus" @click="saveFilter">保存当前筛选</el-button></div><el-input v-model="filterSearch" size="small" placeholder="搜索筛选" clearable /><div class="workspace-tree"><div v-if="!filteredFilters.length" class="workspace-empty">暂无保存筛选</div><button v-for="filter in filteredFilters" :key="filter.id" class="workspace-saved-row" @click="applyFilter(filter)"><span><strong>{{ filter.name }}</strong><small>{{ filter.query.field }} · {{ filter.query.value }}</small></span><i title="删除筛选" @click.stop="removeItem(filter.id)">×</i></button></div><div class="workspace-actions"><el-button size="small" :icon="Download" @click="exportItems">导出</el-button><el-button size="small" :icon="Upload" @click="chooseImport">导入</el-button><input ref="importInput" class="workspace-file-input" type="file" accept="application/json,.json" @change="importItems" /><el-button size="small" type="primary" @click="emit('openQuery')">高级查询</el-button></div>
  </div>
</template>