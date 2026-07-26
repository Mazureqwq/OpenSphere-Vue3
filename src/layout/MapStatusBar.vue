<script setup lang="ts">
import { useMapStore } from '@/stores/map';
import { useWorkspaceContext } from '@/tools/workspaceContext';

const mapStore = useMapStore();
const ctx = useWorkspaceContext();
</script>

<template>
  <footer class="map-status">
    <span>缩放 {{ ctx.currentView.value.zoom.toFixed(1) }}</span>
    <span>
      {{ (ctx.pointerCoordinate.value ?? ctx.currentView.value.center)[0].toFixed(5) }},
      {{ (ctx.pointerCoordinate.value ?? ctx.currentView.value.center)[1].toFixed(5) }}
    </span>
    <span>{{ mapStore.activeBaseMap.name }}</span>
  </footer>
</template>

<style scoped>
.map-status {
  position: absolute;
  z-index: 4;
  right: 0;
  bottom: 0;
  left: 0;
  display: flex;
  align-items: center;
  gap: 24px;
  height: 26px;
  padding: 0 10px;
  border-top: 1px solid #343b43;
  color: #c1cbd4;
  background: rgba(31, 36, 42, 0.94);
  font-family: Consolas, monospace;
  font-size: 10px;
  pointer-events: none;
}
.map-status span:last-child {
  margin-left: auto;
  color: #83bde5;
  font-family: inherit;
}
</style>
