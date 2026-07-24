<script setup lang="ts">
import {nextTick, onBeforeUnmount, onMounted, ref, toRaw, watch} from 'vue';
import MapFeaturePopup from '@/components/MapFeaturePopup.vue';
import {CesiumManager} from '@/map/CesiumManager';
import {MapManager} from '@/map/MapManager';
import type {DrawMode} from '@/map/drawing';
import type {BaseMapOption, LayerRecord, PointVisualizationConfig, SelectedFeatureInfo} from '@/types/gis';
import type {MapViewState} from '@/types/workspace';
import type {PlaybackPosition, PlaybackTrack} from '@/map/trackPlayback';
import {useMapStore} from '@/stores/map';
import {toPopupPosition} from '@/core/mapInteraction.js';

const emit = defineEmits<{viewChange: [state: MapViewState]; pointerChange: [coordinate?: [number, number]]; measurementChange: [value?: string]; drawingChange: []}>();
const mapStore = useMapStore();
const target2d = ref<HTMLElement>();
const target3d = ref<HTMLElement>();
let manager: MapManager | undefined;
let cesiumManager: CesiumManager | undefined;
let realtimeLayer: LayerRecord | undefined;
let playbackOverlay: {track: PlaybackTrack; position: PlaybackPosition; follow: boolean} | undefined;
const popupPosition = ref<{x: number; y: number}>();
const editing = ref(false);
let stopCesiumPopupTracking: (() => void) | undefined;

onMounted(() => {
  if (!target2d.value) return;
  manager = new MapManager(target2d.value, mapStore.activeBaseMap, handleFeatureSelected, (value) => emit('measurementChange', value), () => emit('drawingChange'));
  manager.map.on('moveend', () => emit('viewChange', manager?.getViewState() as MapViewState));
  manager.map.on('pointerdrag', syncPopupPosition);
  manager.map.on('postrender', syncPopupPosition);
  manager.map.on('moveend', syncPopupPosition);
  manager.map.on('pointermove', (event) => emit('pointerChange', manager?.getCoordinateFromPixel(event.pixel)));
  target2d.value.addEventListener('mouseleave', () => emit('pointerChange'));
  target3d.value?.addEventListener('mouseleave', () => emit('pointerChange'));
  target3d.value?.addEventListener('mousemove', handleCesiumPointerMove);
  void switchEngine(mapStore.mapEngine);
});
onBeforeUnmount(() => { stopCesiumPopupTracking?.(); cesiumManager?.destroy(); manager?.dispose(); });

watch(() => mapStore.mapEngine, (engine) => { void switchEngine(engine); });
watch(() => mapStore.layers, syncCesiumLayers, {deep: true});
watch(() => mapStore.queryResults, (results) => cesiumManager?.setQueryResults(results), {deep: true});
watch(() => mapStore.selectedFeature, (feature) => { if (!feature) popupPosition.value = undefined; });
watch(() => mapStore.activeBaseMapId, () => cesiumManager?.setBaseMap(mapStore.activeBaseMap));

async function switchEngine(engine: '2d' | '3d') {
  if (!manager) return;
  popupPosition.value = undefined;
  if (engine === '2d') {
    stopCesiumPopupTracking?.();
    stopCesiumPopupTracking = undefined;
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
  await nextTick();
  manager.setDrawMode();
  manager.stopSpatialQuery();
  if (!cesiumManager) cesiumManager = new CesiumManager(
    target3d.value,
    mapStore.activeBaseMap,
    handleFeatureSelected,
    (value) => emit('measurementChange', value),
    () => { syncCesiumLayers(); emit('drawingChange'); },
  );
  stopCesiumPopupTracking?.();
  stopCesiumPopupTracking = cesiumManager.onSceneRender(syncPopupPosition);
  cesiumManager.setBaseMap(mapStore.activeBaseMap);
  cesiumManager.setQueryResults(mapStore.queryResults);
  syncCesiumLayers();
  cesiumManager.syncRealtimeLayer(realtimeLayer);
  if (playbackOverlay) cesiumManager.setTrackPlayback(playbackOverlay.track, playbackOverlay.position, playbackOverlay.follow);
  cesiumManager.resize();
  cesiumManager.setViewState(manager.getViewState());
}
function handleCesiumPointerMove(event: MouseEvent) {
  if (mapStore.mapEngine !== '3d' || !target3d.value) return;
  const rect = target3d.value.getBoundingClientRect();
  emit('pointerChange', cesiumManager?.getCoordinateFromScreen([event.clientX - rect.left, event.clientY - rect.top]));
}
function handleFeatureSelected(feature?: SelectedFeatureInfo, screenPosition?: number[]) {
  mapStore.setSelectedFeature(feature);
  popupPosition.value = feature ? toPopupPosition(screenPosition) : undefined;
}
function syncPopupPosition() {
  const coordinate = mapStore.selectedFeature?.coordinate;
  if (!popupPosition.value || !coordinate) return;
  const position = mapStore.mapEngine === '3d' ? cesiumManager?.getScreenPosition(coordinate) : manager?.getScreenPosition(coordinate);
  const nextPosition = toPopupPosition(position);
  if (nextPosition) popupPosition.value = nextPosition;
}
function closeFeaturePopup() { mapStore.setSelectedFeature(); popupPosition.value = undefined; }
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
function setPointVisualization(layer: LayerRecord, config: PointVisualizationConfig) { return manager?.setPointVisualization(layer, config) ?? false; }
function clearPointVisualization() { manager?.clearPointVisualization(); }
function syncRealtimeLayer(layer?: LayerRecord) { realtimeLayer = layer; cesiumManager?.syncRealtimeLayer(layer); }
function setTrackPlayback(sourceLayerId: string, track: PlaybackTrack, position: PlaybackPosition, follow: boolean) { playbackOverlay = {track, position, follow}; manager?.setTrackPlayback(sourceLayerId, track, position, follow); cesiumManager?.setTrackPlayback(track, position, follow); }
function clearTrackPlayback() { playbackOverlay = undefined; manager?.clearTrackPlayback(); cesiumManager?.clearTrackPlayback(); }
function locateCoordinate(coordinate: [number, number]) { manager?.locateCoordinate(coordinate); if (mapStore.mapEngine === '3d') cesiumManager?.locateCoordinate(coordinate); }
function focusCoordinate(coordinate: [number, number]) { manager?.focusCoordinate(coordinate); if (mapStore.mapEngine === '3d') cesiumManager?.focusCoordinate(coordinate); }
function clearCoordinateLocation() { manager?.clearCoordinateLocation(); }
defineExpose({addLayer, removeLayer, clearLayers, setBaseMap, getViewState, setViewState, setDrawMode, deleteSelectedDrawingFeatures, startSpatialQuery, focusFeature, setPointVisualization, clearPointVisualization, syncRealtimeLayer, setTrackPlayback, clearTrackPlayback, locateCoordinate, focusCoordinate, clearCoordinateLocation});
</script>

<template>
  <div class="map-container">
    <div ref="target2d" v-show="mapStore.mapEngine === '2d'" class="map-engine map-engine-2d"></div>
    <div ref="target3d" v-show="mapStore.mapEngine === '3d'" class="map-engine cesium-container"></div>
    <MapFeaturePopup v-if="mapStore.selectedFeature && popupPosition" :feature="mapStore.selectedFeature" :position="popupPosition" :editable="editing" @close="closeFeaturePopup" @delete="deleteSelectedFeature" />
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
.engine-switch {
  display: flex;
  flex-direction: row;
}
.engine-switch :deep(.el-button) {
  min-width: 40px;
}

</style>
