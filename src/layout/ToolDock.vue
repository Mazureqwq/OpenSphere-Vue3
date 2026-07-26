<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, ref, watch } from 'vue';
import { useActiveTool } from '@/tools/useActiveTool';
import { useWorkspaceContext } from '@/tools/workspaceContext';

const DRAG_THRESHOLD = 3;

const { activeTool, currentTool, currentTitle } = useActiveTool();
const ctx = useWorkspaceContext();
const visible = computed(() => Boolean(currentTool.value));

const dockRef = ref<HTMLElement>();
const position = ref({ left: 16, top: 16 });
const dragging = ref(false);

let pointerActive = false;
let activePointerId: number | undefined;
let startClientX = 0;
let startClientY = 0;
let originLeft = 16;
let originTop = 16;

const dockStyle = computed(() => ({
  left: `${position.value.left}px`,
  top: `${position.value.top}px`,
}));

function getStageRect() {
  const stage = dockRef.value?.offsetParent as HTMLElement | null;
  return stage?.getBoundingClientRect();
}

function getBounds() {
  const dock = dockRef.value;
  const stage = dock?.offsetParent as HTMLElement | null;
  if (!dock || !stage) {
    return { minLeft: 8, minTop: 8, maxLeft: 8, maxTop: 8 };
  }
  return {
    minLeft: 8,
    minTop: 8,
    maxLeft: Math.max(8, stage.clientWidth - dock.offsetWidth - 8),
    maxTop: Math.max(8, stage.clientHeight - dock.offsetHeight - 8),
  };
}

function clampPosition(left: number, top: number) {
  const bounds = getBounds();
  return {
    left: Math.min(Math.max(left, bounds.minLeft), bounds.maxLeft),
    top: Math.min(Math.max(top, bounds.minTop), bounds.maxTop),
  };
}

function ensureInView() {
  position.value = clampPosition(position.value.left, position.value.top);
}

function detachWindowListeners() {
  window.removeEventListener('pointermove', onWindowPointerMove);
  window.removeEventListener('pointerup', onWindowPointerUp);
  window.removeEventListener('pointercancel', onWindowPointerUp);
  window.removeEventListener('blur', endDrag);
}

function endDrag() {
  pointerActive = false;
  dragging.value = false;
  activePointerId = undefined;
  detachWindowListeners();
  ensureInView();
}

function onWindowPointerMove(event: PointerEvent) {
  if (!pointerActive || event.pointerId !== activePointerId) return;

  const deltaX = event.clientX - startClientX;
  const deltaY = event.clientY - startClientY;

  if (!dragging.value) {
    if (Math.hypot(deltaX, deltaY) < DRAG_THRESHOLD) return;
    dragging.value = true;
  }

  // 用按下时的面板原点 + 鼠标位移，避免 client 坐标和 stage 相对坐标混用
  position.value = clampPosition(originLeft + deltaX, originTop + deltaY);
  event.preventDefault();
}

function onWindowPointerUp(event: PointerEvent) {
  if (event.pointerId !== activePointerId) return;
  endDrag();
}

function onPointerDown(event: PointerEvent) {
  if (event.button !== 0) return;
  const target = event.target as HTMLElement | null;
  if (target?.closest('button, a, input, select, textarea, .el-button')) return;
  if (!dockRef.value) return;

  const stageRect = getStageRect();
  if (!stageRect) return;

  pointerActive = true;
  dragging.value = false;
  activePointerId = event.pointerId;
  startClientX = event.clientX;
  startClientY = event.clientY;
  originLeft = position.value.left;
  originTop = position.value.top;

  window.addEventListener('pointermove', onWindowPointerMove, { passive: false });
  window.addEventListener('pointerup', onWindowPointerUp);
  window.addEventListener('pointercancel', onWindowPointerUp);
  window.addEventListener('blur', endDrag);

  // 不在这里 preventDefault，避免干扰普通点击；真正拖动时再拦截
}

function onWindowResize() {
  ensureInView();
}

watch(visible, async (isVisible) => {
  if (!isVisible) {
    endDrag();
    return;
  }
  await nextTick();
  ensureInView();
});

watch(activeTool, async () => {
  if (!visible.value) return;
  await nextTick();
  ensureInView();
});

window.addEventListener('resize', onWindowResize);
onBeforeUnmount(() => {
  window.removeEventListener('resize', onWindowResize);
  endDrag();
});
</script>

<template>
  <aside
    v-if="visible && currentTool"
    ref="dockRef"
    class="tool-dock"
    :class="{ dragging }"
    :style="dockStyle"
  >
    <header class="dock-header" @pointerdown="onPointerDown">
      <span class="dock-title">
        <i class="drag-handle" aria-hidden="true"></i>
        {{ currentTitle }}
      </span>
      <button type="button" aria-label="关闭工具面板" @click="ctx.closeActiveTool">×</button>
    </header>
    <div class="dock-content">
      <component :is="currentTool.component" />
    </div>
  </aside>
</template>

<style scoped>
.tool-dock {
  position: absolute;
  z-index: 7;
  width: min(348px, calc(100% - 32px));
  max-height: calc(100% - 64px);
  overflow: hidden;
  border: 1px solid #404850;
  border-radius: 4px;
  background: #252b31;
  box-shadow: 0 12px 30px rgba(0, 0, 0, 0.45);
  will-change: left, top;
}
.tool-dock.dragging {
  box-shadow: 0 16px 36px rgba(0, 0, 0, 0.55);
  user-select: none;
}
.dock-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  height: 35px;
  padding: 0 10px;
  border-bottom: 1px solid #454d56;
  color: #f2f6fa;
  background: #20252b;
  font-size: 13px;
  font-weight: 700;
  cursor: grab;
  touch-action: none;
  user-select: none;
}
.tool-dock.dragging .dock-header {
  cursor: grabbing;
}
.dock-title {
  display: inline-flex;
  align-items: center;
  min-width: 0;
  gap: 7px;
  pointer-events: none;
}
.drag-handle {
  width: 10px;
  height: 12px;
  flex: 0 0 auto;
  background:
    radial-gradient(circle, #75b8e7 1.1px, transparent 1.2px) 0 0 / 4px 4px,
    radial-gradient(circle, #75b8e7 1.1px, transparent 1.2px) 0 4px / 4px 4px,
    radial-gradient(circle, #75b8e7 1.1px, transparent 1.2px) 0 8px / 4px 4px,
    radial-gradient(circle, #75b8e7 1.1px, transparent 1.2px) 5px 0 / 4px 4px,
    radial-gradient(circle, #75b8e7 1.1px, transparent 1.2px) 5px 4px / 4px 4px,
    radial-gradient(circle, #75b8e7 1.1px, transparent 1.2px) 5px 8px / 4px 4px;
  opacity: 0.9;
}
.dock-header button {
  width: 22px;
  height: 22px;
  padding: 0;
  border: 0;
  color: #99a5b0;
  background: transparent;
  font-size: 18px;
  cursor: pointer;
}
.dock-header button:hover {
  color: #fff;
}
.dock-content {
  max-height: calc(100vh - 148px);
  overflow: auto;
}
.tool-dock :deep(.panel) {
  min-height: 0;
  margin: 0;
  padding: 14px;
  border: 0;
  border-radius: 0;
  background: #292f35;
}
.tool-dock :deep(.layer-workspace-panel) {
  padding: 0;
}
.tool-dock :deep(.panel-title) {
  padding-bottom: 10px;
  border-bottom: 1px solid #3d454e;
}
.tool-dock :deep(.empty-state) {
  min-height: 150px;
}
</style>
