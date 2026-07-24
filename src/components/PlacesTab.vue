<script setup lang="ts">
import {computed, ref} from "vue";
import {Download, FolderAdd, Upload, Plus} from "@element-plus/icons-vue";
import {ElMessage, ElMessageBox} from "element-plus";
import type {MapViewState} from "@/types/workspace";
import type {SavedPlace, WorkspaceLibrary} from "@/workspaceLibrary";

const props = defineProps<{view: MapViewState; library: WorkspaceLibrary}>();
const emit = defineEmits<{locate: [coordinate: [number, number]]}>();
const placeSearch = ref("");
const placeFolder = ref("");
const importInput = ref<HTMLInputElement>();
const filteredPlaces = computed(() => filterByName(props.library.places, placeSearch.value));
function filterByName<T extends {name: string}>(items: T[], term: string) { const keyword = term.trim().toLocaleLowerCase(); return keyword ? items.filter((item) => item.name.toLocaleLowerCase().includes(keyword)) : items; }
function placesInFolder(folder?: string) { return filteredPlaces.value.filter((place) => (place.folder ?? "") === (folder ?? "")); }
function createId(prefix: string) { return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`; }
async function promptName(title: string, value: string) { try { return (await ElMessageBox.prompt("请输入名称", title, {inputValue: value, confirmButtonText: "确定", cancelButtonText: "取消", inputPattern: /\S/, inputErrorMessage: "名称不能为空"})).value.trim(); } catch { return undefined; } }
async function addFolder() { const name = await promptName("新建收藏夹", ""); if (!name || props.library.folders.includes(name)) return; props.library.folders.push(name); }
async function addPlace() { const name = await promptName("保存地点", `地点 ${props.library.places.length + 1}`); if (!name) return; props.library.places.unshift({id: createId("place"), name, coordinate: [...props.view.center] as [number, number], folder: placeFolder.value || undefined, savedAt: new Date().toISOString()}); }
function removeItem(id: string) { props.library.places = props.library.places.filter((item) => item.id !== id); }
function exportItems() { const blob = new Blob([JSON.stringify({version: 1, kind: "places", items: props.library.places}, null, 2)], {type: "application/json"}); const link = document.createElement("a"); link.href = URL.createObjectURL(blob); link.download = "opensphere-places.json"; link.click(); URL.revokeObjectURL(link.href); }
function chooseImport() { importInput.value?.click(); }
async function importItems(event: Event) { const input = event.target as HTMLInputElement; const file = input.files?.[0]; input.value = ""; if (!file) return; try { const payload = JSON.parse(await file.text()) as {kind?: string; items?: unknown}; if (payload.kind !== "places" || !Array.isArray(payload.items)) throw new Error("文件类型不匹配"); const items = payload.items as Array<SavedPlace>; props.library.places = [...props.library.places, ...items.map((item) => ({...item, id: createId("place")}))]; ElMessage.success(`已导入 ${items.length} 项`); } catch (error) { ElMessage.error(error instanceof Error ? error.message : "导入失败"); } }
</script>

<template>
  <div class="workspace-tab-content">
    <div class="workspace-control-row"><el-button size="small" type="primary" :icon="Plus" @click="addPlace">添加地点</el-button><el-button size="small" :icon="FolderAdd" @click="addFolder">新建收藏夹</el-button></div><el-select v-model="placeFolder" size="small" placeholder="选择收藏夹（可选）" clearable><el-option v-for="folder in library.folders" :key="folder" :label="folder" :value="folder" /></el-select><el-input v-model="placeSearch" size="small" placeholder="搜索收藏地点" clearable /><div class="workspace-tree"><template v-for="folder in library.folders" :key="folder"><strong class="workspace-folder">▾ {{ folder }}</strong><button v-for="place in placesInFolder(folder)" :key="place.id" class="workspace-saved-row" @click="emit('locate', place.coordinate)"><span><strong>{{ place.name }}</strong><small>{{ place.coordinate[0].toFixed(5) }}, {{ place.coordinate[1].toFixed(5) }}</small></span><i title="删除地点" @click.stop="removeItem(place.id)">×</i></button></template><strong v-if="placesInFolder().length" class="workspace-folder">▾ 未分类</strong><button v-for="place in placesInFolder()" :key="place.id" class="workspace-saved-row" @click="emit('locate', place.coordinate)"><span><strong>{{ place.name }}</strong><small>{{ place.coordinate[0].toFixed(5) }}, {{ place.coordinate[1].toFixed(5) }}</small></span><i title="删除地点" @click.stop="removeItem(place.id)">×</i></button><div v-if="!filteredPlaces.length" class="workspace-empty">暂无收藏地点</div></div><div class="workspace-actions"><el-button size="small" :icon="Download" @click="exportItems">导出</el-button><el-button size="small" :icon="Upload" @click="chooseImport">导入</el-button></div><input ref="importInput" class="workspace-file-input" type="file" accept="application/json,.json" @change="importItems" />
  </div>
</template>