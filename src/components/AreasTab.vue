<script setup lang="ts">
import {computed, ref} from "vue";
import {Download, Plus, Upload} from "@element-plus/icons-vue";
import {ElMessage, ElMessageBox} from "element-plus";
import {useMapStore} from "@/stores/map";
import type {SavedArea, WorkspaceLibrary} from "@/workspaceLibrary";

const props = defineProps<{library: WorkspaceLibrary}>();
const emit = defineEmits<{openQuery: []; requestSpatial: []}>();
const mapStore = useMapStore();
const areaSearch = ref("");
const importInput = ref<HTMLInputElement>();
const filteredAreas = computed(() => filterByName(props.library.areas, areaSearch.value));
function filterByName<T extends {name: string}>(items: T[], term: string) { const keyword = term.trim().toLocaleLowerCase(); return keyword ? items.filter((item) => item.name.toLocaleLowerCase().includes(keyword)) : items; }
function createId(prefix: string) { return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`; }
async function promptName(title: string, value: string) { try { return (await ElMessageBox.prompt("请输入名称", title, {inputValue: value, confirmButtonText: "确定", cancelButtonText: "取消", inputPattern: /\S/, inputErrorMessage: "名称不能为空"})).value.trim(); } catch { return undefined; } }
async function saveArea() { const extent = mapStore.query?.spatialExtent; if (!extent) { ElMessage.warning("请先在空间查询中框选范围"); emit("openQuery"); return; } const name = await promptName("保存范围", `范围 ${props.library.areas.length + 1}`); if (!name) return; props.library.areas.unshift({id: createId("area"), name, extent: [...extent] as [number, number, number, number], savedAt: new Date().toISOString()}); }
function applyArea(area: SavedArea) { if (!mapStore.query) { ElMessage.info("请先设置属性查询条件，再应用保存范围"); emit("openQuery"); return; } mapStore.setQueryExtent(area.extent); ElMessage.success(`已应用范围：${area.name}`); }
function removeItem(id: string) { props.library.areas = props.library.areas.filter((item) => item.id !== id); }
function chooseImport() { importInput.value?.click(); }
async function importItems(event: Event) { const input = event.target as HTMLInputElement; const file = input.files?.[0]; input.value = ""; if (!file) return; try { const payload = JSON.parse(await file.text()) as {kind?: string; items?: unknown}; if (payload.kind !== "areas" || !Array.isArray(payload.items)) throw new Error("文件类型不匹配"); const items = payload.items as Array<SavedArea>; props.library.areas = [...props.library.areas, ...items.map((item) => ({...item, id: createId("area")}))]; ElMessage.success(`已导入 ${items.length} 项`); } catch (error) { ElMessage.error(error instanceof Error ? error.message : "导入失败"); } }
function exportItems() { const blob = new Blob([JSON.stringify({version: 1, kind: "areas", items: props.library.areas}, null, 2)], {type: "application/json"}); const link = document.createElement("a"); link.href = URL.createObjectURL(blob); link.download = "opensphere-areas.json"; link.click(); URL.revokeObjectURL(link.href); }
</script>

<template>
  <div class="workspace-tab-content">
    <div class="workspace-control-row"><span>保存的范围</span><el-button size="small" type="primary" :icon="Plus" @click="saveArea">保存当前范围</el-button></div><el-input v-model="areaSearch" size="small" placeholder="搜索范围" clearable /><div class="workspace-tree"><div v-if="!filteredAreas.length" class="workspace-empty">暂无保存范围</div><button v-for="area in filteredAreas" :key="area.id" class="workspace-saved-row" @click="applyArea(area)"><span><strong>{{ area.name }}</strong><small>{{ area.extent.map((value) => value.toFixed(3)).join(', ') }}</small></span><i title="删除范围" @click.stop="removeItem(area.id)">×</i></button></div><div class="workspace-actions"><el-button size="small" :icon="Download" @click="exportItems">导出</el-button><el-button size="small" :icon="Upload" @click="chooseImport">导入</el-button><el-button size="small" type="primary" @click="emit('requestSpatial')">框选范围</el-button><input ref="importInput" class="workspace-file-input" type="file" accept="application/json,.json" @change="importItems" /></div>
  </div>
</template>