<script setup lang="ts">
import { computed, provide, ref } from 'vue';
import MapView from '@/components/MapView.vue';
import WmsLayerDialog from '@/components/WmsLayerDialog.vue';
import AppTopbar from '@/layout/AppTopbar.vue';
import ToolDock from '@/layout/ToolDock.vue';
import MapStatusBar from '@/layout/MapStatusBar.vue';
import type { MapFacade } from '@/map/facade';
import { mapFacadeKey } from '@/map/facade';
import { useMapWorkspace } from '@/composables/useMapWorkspace';
import { workspaceContextKey } from '@/tools/workspaceContext';

const mapFacade = ref<MapFacade>();
const { context, handleViewChange, handlePointerChange, handleMeasurementChange, handleDrawingChange } =
  useMapWorkspace(mapFacade);

provide(mapFacadeKey, mapFacade);
provide(workspaceContextKey, context);

const showWmsDialog = computed({
  get: () => context.showWmsDialog.value,
  set: (value: boolean) => { context.showWmsDialog.value = value; },
});
const measurementText = computed(() => context.measurement.value);

function onMapReady(facade: MapFacade) {
  mapFacade.value = facade;
}
</script>

<template>
  <div class="app-shell">
    <AppTopbar />
    <main class="workspace">
      <section class="map-stage">
        <MapView
          @ready="onMapReady"
          @view-change="handleViewChange"
          @pointer-change="handlePointerChange"
          @measurement-change="handleMeasurementChange"
          @drawing-change="handleDrawingChange"
        />
        <ToolDock />
        <div v-if="context.measurement.value" class="measurement-badge">
          {{ context.measurement.value }}
        </div>
        <MapStatusBar />
      </section>
    </main>
    <WmsLayerDialog v-model="showWmsDialog" @submit="context.addWmsLayer" />
  </div>
</template>

<style scoped>
.app-shell {
  height: 100vh;
  min-height: 620px;
  display: flex;
  flex-direction: column;
  background: #05080d;
}
.workspace {
  height: auto;
  min-height: 0;
  flex: 1;
  display: block;
}
.map-stage {
  position: relative;
  width: 100%;
  height: 100%;
  min-width: 0;
  overflow: hidden;
  background: #0a0d12;
}
.measurement-badge {
  top: auto;
  bottom: 40px;
  left: 16px;
  border-radius: 3px;
}
.map-stage :deep(.map-hint) {
  bottom: 38px;
  left: auto;
  right: 16px;
  border-color: #3f4a54;
  border-radius: 3px;
  background: rgba(31, 36, 42, 0.88);
  font-size: 11px;
}
</style>
