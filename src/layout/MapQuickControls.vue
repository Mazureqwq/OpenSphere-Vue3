<script setup lang="ts">
import { inject } from 'vue';
import { mapFacadeKey } from '@/map/facade';
import { useWorkspaceContext } from '@/tools/workspaceContext';

const ctx = useWorkspaceContext();
const mapFacade = inject(mapFacadeKey);

function changeZoom(delta: number) {
  const view = ctx.currentView.value;
  mapFacade?.value?.setViewState({ ...view, zoom: Math.min(22, Math.max(1, view.zoom + delta)) });
}

function resetBearing() {
  const view = ctx.currentView.value;
  mapFacade?.value?.setViewState({ ...view, rotation: 0 });
}
</script>

<template>
  <aside class="map-quick-controls os-surface" aria-label="地图快捷控件">
    <button type="button" aria-label="放大地图" title="放大" @click="changeZoom(1)">+</button>
    <button type="button" aria-label="缩小地图" title="缩小" @click="changeZoom(-1)">−</button>
    <span class="map-quick-controls__divider" aria-hidden="true"></span>
    <button type="button" aria-label="重置地图朝向" title="重置朝向" class="map-quick-controls__north" @click="resetBearing">N</button>
    <span class="map-quick-controls__divider" aria-hidden="true"></span>
    <button type="button" aria-label="打开内容面板" title="内容和图层" class="map-quick-controls__layers" @click="ctx.openSection('content')">▤</button>
  </aside>
</template>

<style scoped>
.map-quick-controls { position: absolute; z-index: var(--os-z-map-control); top: 14px; left: 14px; display: flex; flex-direction: column; overflow: hidden; border-radius: var(--os-radius-sm); }
.map-quick-controls button { width: 32px; height: 32px; border: 0; color: var(--os-text-secondary); background: var(--os-bg-elevated); font-size: 19px; line-height: 1; cursor: pointer; }
.map-quick-controls button:hover { color: var(--os-text-primary); background: var(--os-bg-hover); }
.map-quick-controls__divider { width: 22px; height: 1px; align-self: center; background: var(--os-border-subtle); }
.map-quick-controls button.map-quick-controls__north { color: var(--os-accent-strong); font-family: Georgia, serif; font-size: 12px; font-weight: 700; }
.map-quick-controls button.map-quick-controls__layers { font-size: 16px; }
@media (max-width: 767px) { .map-quick-controls { top: 10px; left: 10px; } }
</style>
