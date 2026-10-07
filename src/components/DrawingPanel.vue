<script setup lang="ts">
import { computed } from "vue";
import type { DrawMode } from "@/map/drawing";
import { useMapStore } from "@/stores/map";

const props = defineProps<{
  enabled: boolean;
  editing: boolean;
  activeMode?: DrawMode;
}>();
const emit = defineEmits<{
  create: [];
  mode: [mode: DrawMode];
  finish: [];
  cancel: [];
  delete: [];
  clear: [];
}>();
const mapStore = useMapStore();
const hasDrawingLayer = computed(() =>
  mapStore.layers.some((layer) => layer.drawing),
);
const drawingLayer = computed(() =>
  props.enabled
    ? mapStore.layers.find(
        (layer) =>
          layer.id === mapStore.selectedLayerId && layer.kind === "vector",
      )
    : undefined,
);

const drawTools: { mode: DrawMode; label: string }[] = [
  { mode: "Point", label: "画点" },
  { mode: "LineString", label: "画线" },
  { mode: "Polygon", label: "画面" },
];
const measureTools: { mode: DrawMode; label: string }[] = [
  { mode: "measureLine", label: "测距" },
  { mode: "measureArea", label: "测面积" },
];

const hint = computed(() => {
  if (props.activeMode === "modify") return "拖拽顶点调整图形。";
  if (props.activeMode === "measureLine") return "连续点击绘制，双击结束，结果浮层显示。";
  if (props.activeMode === "measureArea") return "连续点击绘制，双击结束，结果浮层显示。";
  if (props.activeMode) return "点击地图绘制，双击结束。";
  return mapStore.mapEngine === "3d"
    ? "3D 下单击加点，右键或双击完成；编辑顶点请切换 2D。"
    : "选择工具开始；选中要素即可拖动顶点。";
});
</script>

<template>
  <section class="panel drawing-panel">
    <div class="panel-title">
      <span>绘制与量测</span
      ><span v-if="drawingLayer" class="count">{{
        drawingLayer.featureCount ?? 0
      }}</span>
    </div>

    <div v-if="!drawingLayer && !hasDrawingLayer" class="empty-state feature-empty">
      创建绘制图层后<br /><small>标注点 / 线 / 面，支持量测</small>
    </div>
    <div v-else-if="!drawingLayer" class="empty-state feature-empty">
      选择绘制图层，或新建一个
    </div>

    <template v-else>
      <div class="tool-group">
        <div class="group-label">绘制</div>
        <div class="tool-grid">
          <el-button
            v-for="tool in drawTools"
            :key="tool.mode"
            size="small"
            :type="activeMode === tool.mode ? 'primary' : 'default'"
            @click="emit('mode', tool.mode)"
            >{{ tool.label }}</el-button
          >
        </div>
      </div>

      <div class="tool-group">
        <div class="group-label">测量</div>
        <div class="tool-grid">
          <el-button
            v-for="tool in measureTools"
            :key="tool.mode"
            size="small"
            :type="activeMode === tool.mode ? 'primary' : 'default'"
            @click="emit('mode', tool.mode)"
            >{{ tool.label }}</el-button
          >
        </div>
      </div>

      <div class="tool-group">
        <div class="group-label">操作</div>
        <div class="tool-grid">
          <el-button size="small" @click="emit('delete')">删除选中</el-button>
          <el-button size="small" type="danger" plain @click="emit('clear')"
            >清除全部</el-button
          >
        </div>
      </div>

      <div v-if="activeMode" class="tool-actions">
        <el-button size="small" type="success" @click="emit('finish')"
          >完成</el-button
        >
        <el-button size="small" plain @click="emit('cancel')">取消</el-button>
      </div>

      <p class="category-note">{{ hint }}</p>
    </template>

    <el-button
      v-if="!drawingLayer"
      class="drawing-create"
      type="primary"
      @click="emit('create')"
      >创建绘制图层</el-button
    >
  </section>
</template>

<style scoped>
.drawing-create {
  width: 100%;
  margin-top: 12px;
}
.tool-group {
  margin-top: 12px;
}
.group-label {
  margin-bottom: 6px;
  color: #94a3b8;
  font-size: 11px;
}
.tool-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  column-gap: 8px;
  row-gap: 8px;
}
.tool-grid :deep(.el-button) {
  width: 100%;
  height: 32px;
  margin: 0;
}
.tool-grid :deep(.el-button + .el-button) {
  margin-left: 0;
}
.tool-actions {
  display: grid;
  grid-template-columns: 1fr 1fr;
  column-gap: 8px;
  margin-top: 14px;
}
.tool-actions :deep(.el-button) {
  width: 100%;
  margin: 0;
}
.tool-actions :deep(.el-button + .el-button) {
  margin-left: 0;
}
</style>
