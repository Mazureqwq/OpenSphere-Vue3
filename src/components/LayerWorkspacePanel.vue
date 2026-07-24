<script setup lang="ts">
import {ref, watch} from "vue";
import {ElMessage} from "element-plus";
import type {MapViewState} from "@/types/workspace";
import {loadWorkspaceLibrary, saveWorkspaceLibrary, type WorkspaceLibrary} from "@/workspaceLibrary";
import LayerTab from "@/components/LayerTab.vue";
import AreasTab from "@/components/AreasTab.vue";
import FiltersTab from "@/components/FiltersTab.vue";
import PlacesTab from "@/components/PlacesTab.vue";
import "./layer-workspace.css";

const props = defineProps<{view: MapViewState}>();
const emit = defineEmits<{
  create: [name: string, type: "drawing" | "vector"];
  remove: [id: string];
  edit: [id: string];
  export: [id: string];
  locate: [coordinate: [number, number]];
  requestSpatial: [];
  openQuery: [];
  baseMap: [];
}>();
const activeTab = ref<"layers" | "areas" | "filters" | "places">("layers");
const library = ref<WorkspaceLibrary>(loadWorkspaceLibrary());
const newLayerDialogVisible = ref(false);
const newLayerName = ref("");
const newLayerType = ref<"drawing" | "vector">("drawing");

watch(library, (value) => saveWorkspaceLibrary(value), {deep: true});
function openNewLayerDialog() {
  newLayerName.value = "";
  newLayerType.value = "drawing";
  newLayerDialogVisible.value = true;
}
function confirmNewLayer() {
  const name = newLayerName.value.trim();
  if (!name) {
    ElMessage.warning("请输入图层名称");
    return;
  }
  emit("create", name, newLayerType.value);
  newLayerDialogVisible.value = false;
}
</script>

<template>
  <section class="panel layer-workspace-panel">
    <el-tabs v-model="activeTab" class="workspace-tabs">
      <el-tab-pane label="图层" name="layers">
        <LayerTab
          @create="openNewLayerDialog"
          @remove="emit('remove', $event)"
          @edit="emit('edit', $event)"
          @export="emit('export', $event)"
          @base-map="emit('baseMap')" />
      </el-tab-pane>
      <el-tab-pane label="范围" name="areas">
        <AreasTab :library="library" @open-query="emit('openQuery')" @request-spatial="emit('requestSpatial')" />
      </el-tab-pane>
      <el-tab-pane label="筛选" name="filters">
        <FiltersTab :library="library" @open-query="emit('openQuery')" />
      </el-tab-pane>
      <el-tab-pane label="地点" name="places">
        <PlacesTab :view="props.view" :library="library" @locate="emit('locate', $event)" />
      </el-tab-pane>
    </el-tabs>
    <el-dialog
      v-model="newLayerDialogVisible"
      title="新建图层"
      width="min(420px, calc(100vw - 32px))"
      align-center
      append-to-body
      :close-on-click-modal="false"
      destroy-on-close>
      <el-form @submit.prevent="confirmNewLayer">
        <el-form-item label="图层名称" required>
          <el-input
            v-model="newLayerName"
            autofocus
            maxlength="50"
            show-word-limit
            placeholder="请输入图层名称"
            @keyup.enter="confirmNewLayer" />
        </el-form-item>
        <el-form-item label="图层类型" required>
          <el-select v-model="newLayerType" style="width: 100%">
            <el-option label="绘制图层" value="drawing" />
            <el-option label="空白矢量图层" value="vector" />
          </el-select>
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="newLayerDialogVisible = false">取消</el-button>
        <el-button type="primary" @click="confirmNewLayer">确定</el-button>
      </template>
    </el-dialog>
  </section>
</template>