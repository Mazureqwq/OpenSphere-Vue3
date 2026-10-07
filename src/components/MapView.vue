<script setup lang="ts">
import {nextTick, onBeforeUnmount, onMounted, ref, toRaw, watch} from 'vue';
import MapFeaturePopup from '@/components/MapFeaturePopup.vue';
import type {CesiumManager} from '@/map/CesiumManager';
import {MapManager} from '@/map/MapManager';
import type {DrawMode} from '@/map/drawing';
import type {BaseMapOption, LayerRecord, PointVisualizationConfig, SelectedFeatureInfo} from '@/types/gis';
import type {MapViewState} from '@/types/workspace';
import type {PlaybackPosition, PlaybackTrack} from '@/map/trackPlayback';
import {useMapStore} from '@/stores/map';
import type { MapFacade } from '@/map/facade';

const emit = defineEmits<{ready: [facade: MapFacade]; viewChange: [state: MapViewState]; pointerChange: [coordinate?: [number, number]]; measurementChange: [value?: string]; drawingChange: []}>();
const mapStore = useMapStore();
const target2d = ref<HTMLElement>();
const target3d = ref<HTMLElement>();
let manager: MapManager | undefined;
let cesiumManager: CesiumManager | undefined;
let cesiumManagerLoading: Promise<CesiumManager | undefined> | undefined;
let realtimeLayer: LayerRecord | undefined;
let playbackOverlay: {track: PlaybackTrack; position: PlaybackPosition; follow: boolean} | undefined;
const editing = ref(false);
const isEngineLoading = ref(false);
let hasUnmounted = false;

onMounted(async () => {
  if (!target2d.value) return;
  manager = new MapManager(target2d.value, mapStore.activeBaseMap, handleFeatureSelected, (value) => emit('measurementChange', value), () => emit('drawingChange'));
  manager.map.on('moveend', () => emit('viewChange', manager?.getViewState() as MapViewState));
  manager.map.on('pointermove', (event) => emit('pointerChange', manager?.getCoordinateFromPixel(event.pixel)));
  target2d.value.addEventListener('mouseleave', () => emit('pointerChange'));
  target3d.value?.addEventListener('mouseleave', () => emit('pointerChange'));
  target3d.value?.addEventListener('mousemove', handleCesiumPointerMove);
  await switchEngine(mapStore.mapEngine);
  emit('ready', facade);
});
onBeforeUnmount(() => { hasUnmounted = true; cesiumManager?.destroy(); manager?.dispose(); });

watch(() => mapStore.mapEngine, (engine) => { void switchEngine(engine); });
watch(() => mapStore.layers, syncCesiumLayers, {deep: true});
watch(() => mapStore.queryResults, (results) => cesiumManager?.setQueryResults(results), {deep: true});
watch(() => mapStore.activeBaseMapId, () => cesiumManager?.setBaseMap(mapStore.activeBaseMap));

async function switchEngine(engine: '2d' | '3d') {
  if (!manager) return;
  if (engine === '2d') {
    isEngineLoading.value = false;
    cesiumManager?.setDrawMode();
    cesiumManager?.stopSpatialQuery();
    const state = cesiumManager?.getViewState(manager.getViewState().rotation);
    if (state) {
      manager.setViewState(state);
      emit('viewChange', state);
    }
    await nextTick();
    manager.map.updateSize();
    return;
  }
  if (!target3d.value) return;
  const needsCesiumManager = !cesiumManager;
  if (needsCesiumManager) isEngineLoading.value = true;
  try {
    await nextTick();
    if (mapStore.mapEngine !== '3d') return;
    manager.setDrawMode();
    manager.stopSpatialQuery();
    const activeCesiumManager = await ensureCesiumManager();
    if (!activeCesiumManager || mapStore.mapEngine !== '3d') return;
    activeCesiumManager.setBaseMap(mapStore.activeBaseMap);
    activeCesiumManager.setQueryResults(mapStore.queryResults);
    syncCesiumLayers();
    activeCesiumManager.syncRealtimeLayer(realtimeLayer);
    if (playbackOverlay) activeCesiumManager.setTrackPlayback(playbackOverlay.track, playbackOverlay.position, playbackOverlay.follow);
    activeCesiumManager.resize();
    activeCesiumManager.setViewState(manager.getViewState());
  } finally {
    if (needsCesiumManager) isEngineLoading.value = false;
  }
}
function ensureCesiumManager(): Promise<CesiumManager | undefined> {
  if (cesiumManager) return Promise.resolve(cesiumManager);
  if (cesiumManagerLoading) return cesiumManagerLoading;
  const target = target3d.value;
  if (!target) return Promise.resolve(undefined);

  const loading = Promise.all([
    import('cesium/Build/Cesium/Widgets/widgets.css'),
    import('@/map/CesiumManager'),
  ]).then(([, {CesiumManager: CesiumManagerConstructor}]) => {
    if (hasUnmounted || mapStore.mapEngine !== '3d' || cesiumManager) return cesiumManager;
    cesiumManager = new CesiumManagerConstructor(
      target,
      mapStore.activeBaseMap,
      handleFeatureSelected,
      (value) => emit('measurementChange', value),
      () => { syncCesiumLayers(); emit('drawingChange'); },
    );
    return cesiumManager;
  });
  cesiumManagerLoading = loading;
  const clearLoading = () => {
    if (cesiumManagerLoading === loading) cesiumManagerLoading = undefined;
  };
  void loading.then(clearLoading, clearLoading);
  return loading;
}
function handleCesiumPointerMove(event: MouseEvent) {
  if (mapStore.mapEngine !== '3d' || !target3d.value) return;
  const rect = target3d.value.getBoundingClientRect();
  emit('pointerChange', cesiumManager?.getCoordinateFromScreen([event.clientX - rect.left, event.clientY - rect.top]));
}
function handleFeatureSelected(feature?: SelectedFeatureInfo) {
  mapStore.setSelectedFeature(feature);
}
function closeFeaturePopup() { mapStore.setSelectedFeature(); }
function focusSelectedFeature() {
  const feature = mapStore.selectedFeature;
  const layer = feature ? mapStore.layers.find((item) => item.id === feature.layerId) : undefined;
  if (!feature || !layer || !feature.featureId) return;
  manager?.focusFeature(toRaw(layer) as unknown as LayerRecord, feature.featureId);
}
function deleteSelectedFeature() {
  const feature = mapStore.selectedFeature;
  const layer = feature ? mapStore.layers.find((item) => item.id === feature.layerId) : undefined;
  if (!feature || !layer || mapStore.mapEngine !== '2d') return;
  const deleted = manager?.deleteFeature(toRaw(layer) as unknown as LayerRecord, feature.featureId) ?? 0;
  if (!deleted) return;
  closeFeaturePopup();
  emit('drawingChange');
}
function syncCesiumLayers() { cesiumManager?.syncLayers(mapStore.layers.map((layer) => toRaw(layer) as unknown as LayerRecord)); }
function addLayer(layer: LayerRecord, zoomToLayer = false) { manager?.addLayer(layer); if (zoomToLayer) manager?.zoomToLayer(layer); syncCesiumLayers(); }
function removeLayer(id: string) { manager?.removeLayerById(id); syncCesiumLayers(); }
function clearLayers() { manager?.clearDataLayers(); realtimeLayer = undefined; playbackOverlay = undefined; cesiumManager?.clearRealtimeLayer(); cesiumManager?.clearTrackPlayback(); syncCesiumLayers(); }
function setBaseMap(baseMap: BaseMapOption) { manager?.setBaseMap(baseMap); cesiumManager?.setBaseMap(baseMap); }
function getViewState() { return manager?.getViewState(); }
function setViewState(state: MapViewState) { manager?.setViewState(state); if (mapStore.mapEngine === '3d') cesiumManager?.setViewState(state); }
function setDrawMode(mode?: DrawMode, layer?: LayerRecord) {
  editing.value = mode === 'modify' && mapStore.mapEngine === '2d';
  if (mapStore.mapEngine === '3d') {
    manager?.setDrawMode();
    return cesiumManager?.setDrawMode(mode, layer) ?? false;
  }
  cesiumManager?.setDrawMode();
  manager?.setDrawMode(mode, layer);
  return true;
}
function deleteSelectedDrawingFeatures(layer?: LayerRecord) {
  return mapStore.mapEngine === '3d'
    ? cesiumManager?.deleteSelectedDrawingFeatures(layer) ?? 0
    : manager?.deleteSelectedDrawingFeatures(layer) ?? 0;
}
function finishDrawing() { manager?.finishDrawing(); }
function abortDrawing() { manager?.abortDrawing(); }
function clearDrawingFeatures(layer: LayerRecord) { manager?.clearDrawingFeatures(layer); }
function startSpatialQuery(onExtent: (extent: [number, number, number, number]) => void) {
  if (mapStore.mapEngine === '3d') {
    manager?.stopSpatialQuery();
    cesiumManager?.startSpatialQuery(onExtent);
    return;
  }
  cesiumManager?.stopSpatialQuery();
  manager?.startSpatialQuery(onExtent);
}
function focusFeature(layer: LayerRecord, featureId: string) { manager?.focusFeature(layer, featureId); }
function zoomToLayer(id: string) {
  const layer = mapStore.layers.find((item) => item.id === id);
  if (!layer) return;
  manager?.zoomToLayer(toRaw(layer) as unknown as LayerRecord);
  const state = manager?.getViewState();
  if (mapStore.mapEngine === '3d' && state) setViewState(state);
}
function setPointVisualization(layer: LayerRecord, config: PointVisualizationConfig) { return manager?.setPointVisualization(layer, config) ?? false; }
function clearPointVisualization() { manager?.clearPointVisualization(); }
function syncRealtimeLayer(layer?: LayerRecord) { realtimeLayer = layer; cesiumManager?.syncRealtimeLayer(layer); }
function setTrackPlayback(sourceLayerId: string, track: PlaybackTrack, position: PlaybackPosition, follow: boolean) { playbackOverlay = {track, position, follow}; manager?.setTrackPlayback(sourceLayerId, track, position, follow); cesiumManager?.setTrackPlayback(track, position, follow); }
function clearTrackPlayback() { playbackOverlay = undefined; manager?.clearTrackPlayback(); cesiumManager?.clearTrackPlayback(); }
function onUserInteract(callback: () => void) { manager?.setUserInteractHandler(callback); cesiumManager?.setUserInteractHandler(callback); return () => { manager?.setUserInteractHandler(undefined); cesiumManager?.setUserInteractHandler(undefined); }; }
function locateCoordinate(coordinate: [number, number]) { manager?.locateCoordinate(coordinate); if (mapStore.mapEngine === '3d') cesiumManager?.locateCoordinate(coordinate); }
function focusCoordinate(coordinate: [number, number]) { manager?.focusCoordinate(coordinate); if (mapStore.mapEngine === '3d') cesiumManager?.focusCoordinate(coordinate); }
function clearCoordinateLocation() { manager?.clearCoordinateLocation(); }
const facade: MapFacade = {
  addLayer,
  removeLayer,
  clearLayers,
  setBaseMap,
  getViewState,
  setViewState,
  setDrawMode,
  finishDrawing,
  abortDrawing,
  clearDrawingFeatures,
  deleteSelectedDrawingFeatures,
  startSpatialQuery,
  focusFeature,
  zoomToLayer,
  setPointVisualization,
  clearPointVisualization,
  syncRealtimeLayer,
  setTrackPlayback,
  clearTrackPlayback,
  onUserInteract,
  locateCoordinate,
  focusCoordinate,
  clearCoordinateLocation,
};
defineExpose(facade);
</script>

<template>
  <div class="map-container">
    <div ref="target2d" v-show="mapStore.mapEngine === '2d'" class="map-engine map-engine-2d"></div>
    <div ref="target3d" v-show="mapStore.mapEngine === '3d'" class="map-engine cesium-container"></div>
    <div v-if="isEngineLoading" class="map-engine-loading" role="status" aria-live="polite">
      <span class="map-engine-loading__indicator" aria-hidden="true"></span>
      <span>正在准备三维引擎</span>
    </div>
    <MapFeaturePopup v-if="mapStore.selectedFeature" :feature="mapStore.selectedFeature" :editable="editing" @close="closeFeaturePopup" @delete="deleteSelectedFeature" @focus="focusSelectedFeature" />
    <div class="map-hint">{{ mapStore.mapEngine === '3d' ? 'Cesium 3D：支持点、线、面绘制与测地量算；右键或双击完成' : '点击矢量要素查看属性 · 绘制线、面可实时量测' }}</div>
  </div>
</template>



<style scoped>
.map-container {
  position: relative;
  width: 100%;
  height: 100%;
}
.map-engine {
  position: absolute;
  inset: 0;
}
.cesium-container .cesium-widget,
.cesium-container canvas {
  width: 100%;
  height: 100%;
}
.cesium-container .cesium-viewer-bottom {
  display: none;
}
.map-engine-loading {
  position: absolute;
  inset: 0;
  z-index: 20;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 10px;
  color: #d7e0ec;
  background: rgb(10 17 25 / 82%);
  font-size: 12px;
  letter-spacing: .04em;
  pointer-events: none;
}
.map-engine-loading__indicator {
  width: 14px;
  height: 14px;
  border: 2px solid rgb(102 160 204 / 32%);
  border-top-color: #76b7e7;
  border-radius: 50%;
  animation: map-engine-loading-spin .8s linear infinite;
}
.engine-switch {
  display: flex;
  flex-direction: row;
}
.engine-switch :deep(.el-button) {
  min-width: 40px;
}
@keyframes map-engine-loading-spin {
  to { transform: rotate(1turn); }
}
@media (prefers-reduced-motion: reduce) {
  .map-engine-loading__indicator { animation: none; }
}

</style>
