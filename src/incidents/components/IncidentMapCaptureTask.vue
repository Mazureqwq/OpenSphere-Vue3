<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, ref, watch } from 'vue';
import { useIncidentGeometryCaptureTask } from '../presentation/useIncidentGeometryCaptureTask';

const task = useIncidentGeometryCaptureTask();
const card = ref<HTMLElement>();
const isPointMode = computed(() => task.state.value.mode === 'Point');

watch(() => task.active.value, (active) => {
  if (active) void nextTick(() => card.value?.focus());
});

onBeforeUnmount(() => task.cancel());
</script>

<template>
  <Teleport to=".atlas-map-stage">
    <aside
      v-if="task.active.value"
      ref="card"
      class="incident-map-capture-task os-surface"
      role="region"
      aria-label="事件位置标注任务"
      aria-live="polite"
      tabindex="-1"
    >
      <header class="incident-map-capture-task__header">
        <div>
          <p>新建事件</p>
          <strong>{{ isPointMode ? '标注事件位置' : '圈定事件影响范围' }}</strong>
        </div>
        <button type="button" class="incident-map-capture-task__close" aria-label="取消地图标注" title="取消地图标注" @click="task.cancel">×</button>
      </header>

      <div class="incident-map-capture-task__modes" role="group" aria-label="标注方式">
        <button type="button" :class="{ 'is-active': isPointMode }" :aria-pressed="isPointMode" @click="task.selectMode('Point')">地点</button>
        <button type="button" :class="{ 'is-active': !isPointMode }" :aria-pressed="!isPointMode" @click="task.selectMode('Polygon')">圈定范围</button>
      </div>

      <p v-if="isPointMode" class="incident-map-capture-task__hint">在地图上单击以确定事件位置。<kbd>Esc</kbd> 取消</p>
      <template v-else>
        <p class="incident-map-capture-task__hint">单击添加顶点；至少 3 点后可完成。</p>
        <p class="incident-map-capture-task__count">已添加 {{ task.state.value.vertexCount }} 个顶点</p>
        <div class="incident-map-capture-task__actions">
          <button type="button" :disabled="!task.canUndo.value" @click="task.undo">撤销上一点</button>
          <button type="button" class="is-primary" :disabled="!task.canFinish.value" @click="task.finish">完成绘制</button>
          <button type="button" @click="task.cancel">取消</button>
        </div>
        <p class="incident-map-capture-task__shortcut">双击、右键或 Enter 完成；Esc 取消。</p>
      </template>
    </aside>
  </Teleport>
</template>
