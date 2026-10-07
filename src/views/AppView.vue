<script setup lang="ts">
import { computed, defineAsyncComponent, onBeforeUnmount, onMounted, provide, ref } from 'vue';
import WmsLayerDialog from '@/components/WmsLayerDialog.vue';
import AppTopbar from '@/layout/AppTopbar.vue';
import TaskRail from '@/layout/TaskRail.vue';
import ContentPanel from '@/layout/ContentPanel.vue';
import InspectorPanel from '@/layout/InspectorPanel.vue';
import BottomDrawer from '@/layout/BottomDrawer.vue';
import MapQuickControls from '@/layout/MapQuickControls.vue';
import MapStatusBar from '@/layout/MapStatusBar.vue';
import type { MapFacade } from '@/map/facade';
import { mapFacadeKey } from '@/map/facade';
import { useMapWorkspace } from '@/composables/useMapWorkspace';
import { workspaceContextKey } from '@/tools/workspaceContext';

const MapView = defineAsyncComponent(() => import('@/components/MapView.vue'));
const mapFacade = ref<MapFacade>();
const mapReady = ref(false);
const { context, handleViewChange, handlePointerChange, handleMeasurementChange, handleDrawingChange } =
  useMapWorkspace(mapFacade);

provide(mapFacadeKey, mapFacade);
provide(workspaceContextKey, context);

const showWmsDialog = computed({
  get: () => context.showWmsDialog.value,
  set: (value: boolean) => { context.showWmsDialog.value = value; },
});

function onMapReady(facade: MapFacade) {
  mapFacade.value = facade;
  mapReady.value = true;
  void context.loadDemoData();
}

function onWindowKeydown(event: KeyboardEvent) {
  if (event.key !== 'Escape' || event.defaultPrevented) return;
  const target = event.target as HTMLElement | null;
  if (target?.closest('.el-overlay, .el-popper')) return;
  if (context.activeDrawingMode.value) {
    context.cancelCurrentDrawing();
  } else if (context.bottomDrawerTab.value) {
    context.closeActiveTool();
  } else if (context.inspectorTarget.value) {
    context.closeInspector();
  } else if (context.contentPanelOpen.value) {
    context.toggleContentPanel();
  } else {
    return;
  }
  event.preventDefault();
}

onMounted(() => window.addEventListener('keydown', onWindowKeydown));
onBeforeUnmount(() => window.removeEventListener('keydown', onWindowKeydown));
</script>

<template>
  <div class="atlas-app-shell os-workbench">
    <AppTopbar />
    <main class="atlas-workspace">
      <TaskRail />
      <ContentPanel />
      <section class="atlas-map-stage" aria-label="地图画布" :aria-busy="!mapReady">
        <MapView
          @ready="onMapReady"
          @view-change="handleViewChange"
          @pointer-change="handlePointerChange"
          @measurement-change="handleMeasurementChange"
          @drawing-change="handleDrawingChange"
        />
        <div v-if="!mapReady" class="atlas-map-startup" role="status" aria-live="polite">
          <span class="atlas-map-startup__indicator" aria-hidden="true"></span>
          <div>
            <strong>准备地图工作区</strong>
            <span>正在加载地图引擎</span>
          </div>
        </div>
        <MapQuickControls />
        <InspectorPanel />
        <BottomDrawer />
        <div v-if="context.measurement.value" class="measurement-badge atlas-measurement-badge">
          {{ context.measurement.value }}
        </div>
        <MapStatusBar />
      </section>
    </main>
    <WmsLayerDialog v-model="showWmsDialog" @submit="context.addWmsLayer" />
  </div>
</template>

<style scoped>
.atlas-app-shell { height: 100vh; min-height: 560px; display: flex; flex-direction: column; overflow: hidden; background: var(--os-bg-canvas); }
.atlas-workspace { min-height: 0; flex: 1; display: flex; overflow: hidden; }
.atlas-map-stage { position: relative; min-width: 0; min-height: 0; flex: 1; overflow: hidden; background: #0a1119; }
.atlas-map-startup { position: absolute; inset: 0; z-index: 100; display: flex; align-items: center; justify-content: center; gap: 12px; color: #d8e1ec; background: radial-gradient(circle at 50% 44%, rgb(36 71 96 / 48%), transparent 42%), #0a1119; font-size: 12px; letter-spacing: .04em; pointer-events: none; }
.atlas-map-startup div { display: grid; gap: 4px; }
.atlas-map-startup strong { color: #f0f5fa; font-size: 13px; font-weight: 600; }
.atlas-map-startup span { color: #98aabb; }
.atlas-map-startup__indicator { width: 18px; height: 18px; border: 2px solid rgb(113 177 219 / 28%); border-top-color: #76b7e7; border-radius: 50%; animation: atlas-map-startup-spin .8s linear infinite; }
.atlas-measurement-badge { z-index: var(--os-z-map-control); top: auto; bottom: 40px; left: 14px; border-radius: 4px; }
.atlas-map-stage :deep(.ol-zoom) { display: none; }
.atlas-map-stage :deep(.map-hint) { z-index: var(--os-z-map-control); bottom: 40px; left: auto; right: 16px; border-color: var(--os-border-strong); border-radius: 4px; background: rgb(18 25 35 / 88%); font-size: 11px; }
@keyframes atlas-map-startup-spin { to { transform: rotate(1turn); } }
@media (prefers-reduced-motion: reduce) { .atlas-map-startup__indicator { animation: none; } }
@media (max-width: 767px) { .atlas-app-shell { min-height: 480px; } .atlas-workspace { position: relative; } .atlas-measurement-badge { left: 10px; } .atlas-map-stage :deep(.map-hint) { right: 10px; } }
</style>
