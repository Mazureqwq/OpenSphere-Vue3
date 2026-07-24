<script setup lang="ts">
import { ref, toRaw, watch } from "vue";
import { ElMessage } from "element-plus";
import {
  Collection,
  Delete,
  EditPen,
  FolderOpened,
  Location,
  MoreFilled,
  Timer,
} from "@element-plus/icons-vue";
import MapView from "@/components/MapView.vue";
import SearchPanel from "@/components/SearchPanel.vue";
import QueryPanel from "@/components/QueryPanel.vue";
import RealtimePanel from "@/components/RealtimePanel.vue";
import PointVisualizationPanel from "@/components/PointVisualizationPanel.vue";
import TrackPlaybackPanel from "@/components/TrackPlaybackPanel.vue";
import CoordinatePanel from "@/components/CoordinatePanel.vue";
import CategoryStylePanel from "@/components/CategoryStylePanel.vue";
import DrawingPanel from "@/components/DrawingPanel.vue";
import FeatureInfoPanel from "@/components/FeatureInfoPanel.vue";
import LegendPanel from "@/components/LegendPanel.vue";
import LayerWorkspacePanel from "@/components/LayerWorkspacePanel.vue";
import TimeFieldPanel from "@/components/TimeFieldPanel.vue";
import TimelinePanel from "@/components/TimelinePanel.vue";
import VectorStylePanel from "@/components/VectorStylePanel.vue";
import WmsLayerDialog from "@/components/WmsLayerDialog.vue";
import { createVectorLayer, type DrawMode } from "@/map/drawing";
import { getLayerName } from "@/core/mapInteraction.js";
import {
  importCsv,
  importGeoJson,
  importGpx,
  importKml,
  importKmz,
  importShapefile,
} from "@/map/importers";


import { useMapStore } from "@/stores/map";
import type { BaseMapOption, LayerRecord, PointVisualizationConfig } from "@/types/gis";
import { getPlaybackPosition, type PlaybackTrack } from "@/map/trackPlayback";
import type { MapViewState } from "@/types/workspace";
import { useWorkspacePersistence } from "@/composables/useWorkspacePersistence";
import { useDrawingSession } from "@/composables/useDrawingSession";
import {
  useLayerActions,
  type LayerImportHandler,
} from "@/composables/useLayerActions";
import { useRealtimeTracking } from "@/composables/useRealtimeTracking";
import { useSearch } from "@/composables/useSearch";
import { useTrackPlayback } from "@/composables/useTrackPlayback";
import { usePointVisualization } from "@/composables/usePointVisualization";

const mapStore = useMapStore();
const mapView = ref<{
  addLayer: (layer: LayerRecord, zoomToLayer?: boolean) => void;
  removeLayer: (id: string) => void;
  clearLayers: () => void;
  setBaseMap: (baseMap: BaseMapOption) => void;
  getViewState: () => MapViewState | undefined;
  setViewState: (state: MapViewState) => void;
  setDrawMode: (mode?: DrawMode, layer?: LayerRecord) => void;
  deleteSelectedDrawingFeatures: (layer?: LayerRecord) => number;
  startSpatialQuery: (
    onExtent: (extent: [number, number, number, number]) => void,
  ) => void;
  focusFeature: (layer: LayerRecord, featureId: string) => void;
  setPointVisualization: (
    layer: LayerRecord,
    config: PointVisualizationConfig,
  ) => boolean;
  clearPointVisualization: () => void;
  syncRealtimeLayer: (layer?: LayerRecord) => void;
  setTrackPlayback: (
    sourceLayerId: string,
    track: PlaybackTrack,
    position: ReturnType<typeof getPlaybackPosition>,
    follow: boolean,
  ) => void;
  clearTrackPlayback: () => void;
  locateCoordinate: (coordinate: [number, number]) => void;
  focusCoordinate: (coordinate: [number, number]) => void;
  clearCoordinateLocation: () => void;
}>();
const showWmsDialog = ref(false);
const currentView = ref<MapViewState>({
  center: [113.6254, 34.7466],
  zoom: 5,
  rotation: 0,
});
const measurement = ref<string>();
const importers: Record<string, LayerImportHandler> = {
  csv: importCsv,
  geojson: importGeoJson,
  json: importGeoJson,
  kml: importKml,
  kmz: importKmz,
  gpx: importGpx,
  zip: importShapefile,
};
const {
  addLayer,
  handleFiles,
  addWmsLayer,
  handleRemoveLayer,
  editLayer,
  exportLayer,
} = useLayerActions({
  mapStore,
  mapView,
  importers,
  onBeforeRemove: (layer) => {
    if (layer.drawing) stopDrawing();
    if (layer.realtime) stopRealtimeTracking();
    if (layer.id === playbackSourceLayerId.value) clearTrackPlayback();
  },
  onEdit: (layer) => {
    startDrawingSession(layer.id, true);
    activeTool.value = "drawing";
  },
});
const {
  status: realtimeStatus,
  trackCount: realtimeTrackCount,
  lastUpdated: realtimeLastUpdated,
  error: realtimeError,
  layerId: realtimeLayerId,
  connect: connectRealtime,
  disconnect: disconnectRealtime,
  startSimulation: startRealtimeSimulation,
  stopSimulation: stopRealtimeSimulation,
  stop: stopRealtimeTracking,
} = useRealtimeTracking({
  mapStore,
  mapView,
  addLayer,
});
const {
  scheduleWorkspaceSave,
  saveWorkspaceNow,
  restoreWorkspaceState,
  clearWorkspaceState,
} = useWorkspacePersistence({
  mapStore,
  mapView,
  currentView,
  onBeforeRestore: () => {
    stopRealtimeTracking();
    clearTrackPlayback();
  },
  onBeforeClear: () => {
    stopRealtimeTracking();
    clearTrackPlayback();
  },
});
const {
  drawingSessionLayerId,
  drawingEditing,
  activeDrawingMode,
  start: startDrawingSession,
  setDrawMode,
  cancelCurrentDrawing,
  stopDrawing,
  deleteSelectedDrawingFeatures,
} = useDrawingSession({
  mapStore,
  mapView,
  measurement,
});
const pointerCoordinate = ref<[number, number]>();
const {
  results: searchResults,
  loading: searchLoading,
  service: searchService,
  search,
  clear: clearSearch,
  select: selectSearchResult,
} = useSearch({ mapStore, mapView, currentView });
const {
  tracks: playbackTracks,
  state: playbackState,
  follow: playbackFollow,
  controller: playbackController,
  selectTrack: selectPlaybackTrack,
  play: playTrackPlayback,
  pause: pauseTrackPlayback,
  seek: seekTrackPlayback,
  setSpeed: setPlaybackSpeed,
  load: loadTrackPlayback,
  setFollow: setPlaybackFollow,
  clear: clearTrackPlayback,
  sourceLayerId: playbackSourceLayerId,
} = useTrackPlayback({ mapStore, mapView });
const { apply: applyPointVisualization, clear: clearPointVisualization } = usePointVisualization({ mapStore, mapView });
type ToolId =
  | "layers"
  | "realtime"
  | "visualization"
  | "coordinate"
  | "playback"
  | "drawing"
  | "query"
  | "vectorStyle"
  | "categoryStyle"
  | "legend"
  | "timeField"
  | "timeline"
  | "feature";
const activeTool = ref<ToolId | undefined>("layers");
const toolTitles: Record<ToolId, string> = {
  layers: "图层",
  realtime: "实时轨迹",
  visualization: "点位展示",
  coordinate: "坐标定位",
  playback: "轨迹回放",
  drawing: "绘制与量测",
  query: "空间属性查询",
  vectorStyle: "基础样式",
  categoryStyle: "分类样式",
  legend: "图例",
  timeField: "时间字段",
  timeline: "时间轴",
  feature: "要素信息",
};
function handleBaseMapChange() {
  mapView.value?.setBaseMap(mapStore.activeBaseMap);
}
function toggleTool(tool: ToolId) {
  if (activeTool.value === "drawing" && tool !== "drawing") stopDrawing();
  const openingDrawing = tool === "drawing" && activeTool.value !== "drawing";
  activeTool.value = activeTool.value === tool ? undefined : tool;
  if (openingDrawing && !drawingSessionLayerId.value) {
    const layer = mapStore.layers.find((item) => item.drawing);
    if (layer) startDrawingSession(layer.id);
  }
}
function closeActiveTool() {
  if (activeTool.value === "drawing") stopDrawing();
  activeTool.value = undefined;
}
function locateCoordinate(coordinate: [number, number]) {
  if (!mapView.value) {
    ElMessage.warning("地图尚未初始化，请稍后重试");
    return;
  }
  mapView.value.locateCoordinate(coordinate);
  ElMessage.success(
    "已定位到 " + coordinate[0].toFixed(6) + ", " + coordinate[1].toFixed(6),
  );
}



function handleViewChange(state: MapViewState) {
  currentView.value = state;
  scheduleWorkspaceSave();
}
function createDrawingLayer(
  name?: string,
  layerType: "drawing" | "vector" = "drawing",
) {
  const drawingCount = mapStore.layers.filter((item) => item.drawing).length;
  const vectorCount = mapStore.layers.filter(
    (item) => item.kind === "vector" && !item.drawing,
  ).length;
  const isDrawingLayer = layerType === "drawing";
  const layer = createVectorLayer(
    getLayerName({ name, layerType, drawingCount, vectorCount }),
    isDrawingLayer,
  );
  addLayer(layer);
  mapStore.selectedLayerId = layer.id;
  startDrawingSession(layer.id);
  ElMessage.success(`已创建${layer.name}`);
}
function requestSpatialQuery() {
  mapView.value?.startSpatialQuery((extent) => {
    mapStore.setQueryExtent(extent);
    ElMessage.success("已应用空间范围筛选");
  });
  ElMessage.info("请在地图上按住 Shift 并拖拽矩形范围");
}
function focusQueryResult(layerId: string, featureId: string) {
  const layer = mapStore.layers.find((item) => item.id === layerId);
  if (layer)
    mapView.value?.focusFeature(
      toRaw(layer) as unknown as LayerRecord,
      featureId,
    );
}
function handleDrawingChange() {
  const layer = mapStore.layers.find(
    (item) => item.id === drawingSessionLayerId.value && item.kind === "vector",
  );
  if (layer) mapStore.refreshFeatureCount(layer.id);
  scheduleWorkspaceSave();
}
</script>

<template>
  <div class="app-shell">
    <header class="topbar">
      <div class="toolbar-left">
        <div class="brand">
          <span class="brand-mark">◎</span><span>OpenSphere</span>
        </div>
        <label class="upload-button"
          ><el-icon><FolderOpened /></el-icon><span>导入</span
          ><input
            type="file"
            accept=".geojson,.json,.csv,.kml,.kmz,.gpx,.zip"
            multiple
            @change="handleFiles(($event.target as HTMLInputElement).files)"
        /></label>
        <el-button
          size="small"
          :type="activeTool === 'layers' ? 'primary' : 'default'"
          :icon="Collection"
          @click="toggleTool('layers')"
          >图层</el-button
        >
        <el-button
          size="small"
          :type="activeTool === 'drawing' ? 'primary' : 'default'"
          :icon="EditPen"
          @click="toggleTool('drawing')"
          >绘制</el-button
        >
        <el-button
          size="small"
          :type="activeTool === 'timeline' ? 'primary' : 'default'"
          :icon="Timer"
          @click="toggleTool('timeline')"
          >时间轴</el-button
        >
        <el-dropdown trigger="click" class="more-dropdown">
          <el-button size="small" :icon="MoreFilled"
            ><span class="more-label">更多</span></el-button
          >
          <template #dropdown>
            <el-dropdown-menu>
              <el-dropdown-item @click="toggleTool('query')"
                >空间查询</el-dropdown-item
              >
              <el-dropdown-item @click="toggleTool('visualization')"
                >热力图与聚合</el-dropdown-item
              >
              <el-dropdown-item @click="toggleTool('realtime')"
                >实时轨迹</el-dropdown-item
              >
              <el-dropdown-item @click="toggleTool('playback')"
                >轨迹回放</el-dropdown-item
              >
              <el-dropdown-item @click="toggleTool('coordinate')"
                >坐标定位</el-dropdown-item
              >
              <el-dropdown-item divided @click="toggleTool('vectorStyle')"
                >基础样式</el-dropdown-item
              >
              <el-dropdown-item @click="toggleTool('categoryStyle')"
                >分类样式</el-dropdown-item
              >
              <el-dropdown-item @click="toggleTool('legend')"
                >图例</el-dropdown-item
              >
              <el-dropdown-item @click="toggleTool('timeField')"
                >时间字段</el-dropdown-item
              >
              <el-dropdown-item @click="toggleTool('feature')"
                >要素信息</el-dropdown-item
              >
              <el-dropdown-item divided @click="showWmsDialog = true"
                >添加 WMS 图层</el-dropdown-item
              >
              <el-dropdown-item @click="saveWorkspaceNow"
                >保存当前工作区</el-dropdown-item
              >
              <el-dropdown-item @click="restoreWorkspaceState()"
                >恢复已保存工作区</el-dropdown-item
              >
              <el-dropdown-item divided @click="clearWorkspaceState"
                ><el-icon><Delete /></el-icon>清空工作区</el-dropdown-item
              >
            </el-dropdown-menu>
          </template>
        </el-dropdown>
      </div>
      <div class="toolbar-right">
        <SearchPanel
          variant="toolbar"
          :results="searchResults"
          :loading="searchLoading"
          :providers="searchService.getProviderNames()"
          @search="search"
          @select="selectSearchResult"
          @clear="clearSearch" />
        <el-tooltip content="坐标定位" placement="bottom"
          ><el-button
            size="small"
            :icon="Location"
            @click="toggleTool('coordinate')"
            class="icon-only-btn"
            ><span class="btn-text">定位</span></el-button
          ></el-tooltip
        >
        <el-button-group class="engine-switch"
          ><el-button
            size="small"
            :type="mapStore.mapEngine === '2d' ? 'primary' : 'default'"
            @click="mapStore.setMapEngine('2d')"
            >2D</el-button
          ><el-button
            size="small"
            :type="mapStore.mapEngine === '3d' ? 'primary' : 'default'"
            @click="mapStore.setMapEngine('3d')"
            >3D</el-button
          ></el-button-group
        ><el-select
          v-model="mapStore.activeBaseMapId"
          size="small"
          class="basemap-select"
          @change="handleBaseMapChange"
          ><el-option
            v-for="item in mapStore.baseMaps"
            :key="item.id"
            :label="item.name"
            :value="item.id"
        /></el-select>
      </div>
    </header>
    <main class="workspace">
      <section class="map-stage">
        <MapView
          ref="mapView"
          @view-change="handleViewChange"
          @pointer-change="(coordinate) => (pointerCoordinate = coordinate)"
          @measurement-change="(value) => (measurement = value)"
          @drawing-change="handleDrawingChange" />
        <aside v-if="activeTool" class="tool-dock">
          <header class="dock-header">
            <span>{{ toolTitles[activeTool] }}</span
            ><button
              type="button"
              aria-label="关闭工具面板"
              @click="closeActiveTool">
              ×
            </button>
          </header>
          <div class="dock-content">
            <LayerWorkspacePanel
              v-if="activeTool === 'layers'"
              :view="currentView"
              @create="createDrawingLayer"
              @remove="handleRemoveLayer"
              @edit="editLayer"
              @export="exportLayer"
              @locate="locateCoordinate"
              @base-map="handleBaseMapChange"
              @request-spatial="requestSpatialQuery"
              @open-query="activeTool = 'query'" /><RealtimePanel
              v-else-if="activeTool === 'realtime'"
              :status="realtimeStatus"
              :track-count="realtimeTrackCount"
              :last-updated="realtimeLastUpdated"
              :error="realtimeError"
              @connect="connectRealtime"
              @disconnect="disconnectRealtime"
              @start-simulation="startRealtimeSimulation"
              @stop-simulation="stopRealtimeSimulation" /><PointVisualizationPanel
              v-else-if="activeTool === 'visualization'"
              @apply="applyPointVisualization"
              @clear="clearPointVisualization" /><CoordinatePanel
              v-else-if="activeTool === 'coordinate'"
              @locate="locateCoordinate" /><TrackPlaybackPanel
              v-else-if="activeTool === 'playback'"
              :tracks="playbackTracks"
              :state="playbackState"
              :follow="playbackFollow"
              @load="loadTrackPlayback"
              @select-track="selectPlaybackTrack"
              @play="playTrackPlayback"
              @pause="pauseTrackPlayback"
              @seek="seekTrackPlayback"
              @speed="setPlaybackSpeed"
              @follow="setPlaybackFollow"
              @clear="clearTrackPlayback" /><DrawingPanel
              v-else-if="activeTool === 'drawing'"
              :enabled="Boolean(drawingSessionLayerId)"
              :editing="drawingEditing"
              @create="createDrawingLayer"
              @mode="setDrawMode"
              @stop="cancelCurrentDrawing" /><QueryPanel
              v-else-if="activeTool === 'query'"
              @request-spatial="requestSpatialQuery"
              @focus="focusQueryResult" /><VectorStylePanel
              v-else-if="activeTool === 'vectorStyle'" /><CategoryStylePanel
              v-else-if="activeTool === 'categoryStyle'" /><LegendPanel
              v-else-if="activeTool === 'legend'" /><TimeFieldPanel
              v-else-if="activeTool === 'timeField'" /><FeatureInfoPanel
              v-else-if="activeTool === 'feature'" /><TimelinePanel
              v-else-if="activeTool === 'timeline'" />
          </div>
        </aside>
        <div v-if="measurement" class="measurement-badge">
          {{ measurement }}
        </div>
        <footer class="map-status">
          <span>缩放 {{ currentView.zoom.toFixed(1) }}</span
          ><span
            >{{ (pointerCoordinate ?? currentView.center)[0].toFixed(5) }},
            {{ (pointerCoordinate ?? currentView.center)[1].toFixed(5) }}</span
          ><span>{{ mapStore.activeBaseMap.name }}</span>
        </footer>
      </section>
    </main>
    <WmsLayerDialog v-model="showWmsDialog" @submit="addWmsLayer" />
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
.topbar {
  position: relative;
  z-index: 20;
  height: 48px;
  flex: 0 0 48px;
  justify-content: space-between;
  gap: 12px;
  padding: 0 8px;
  border-bottom-color: #3b4047;
  background: #20252b;
  overflow: visible;
}
.toolbar-left,
.toolbar-right {
  display: flex;
  align-items: center;
  flex-wrap: nowrap;
  min-width: 0;
  gap: 6px;
}
.toolbar-left {
  flex: 0 1 auto;
}
.toolbar-right {
  justify-content: flex-end;
}
.toolbar-right .search-panel-toolbar {
  flex: 1 1 360px;
}
.brand {
  flex: 0 0 auto;
  gap: 6px;
  padding-right: 7px;
  font-size: 15px;
}
.brand-mark {
  font-size: 21px;
}

/* 响应式工具栏：窄屏横向滚动 + 仅显示图标 */
.toolbar-left .icon-only-btn .btn-text,
.toolbar-right .icon-only-btn .btn-text {
  display: inline;
}
@media (max-width: 1100px) {
  .toolbar-left .icon-only-btn .btn-text,
  .toolbar-right .icon-only-btn .btn-text {
    display: none;
  }
  .toolbar-left .icon-only-btn,
  .toolbar-right .icon-only-btn {
    padding: 0 8px;
    min-width: 36px;
  }
  .more-dropdown :deep(.el-button) {
    padding: 0 10px;
  }
}
@media (max-width: 800px) {
  .topbar {
    gap: 8px;
    padding: 0 6px;
  }
  .brand span:last-child {
    display: none;
  }
  .upload-button span {
    display: none;
  }
  .more-label {
    display: none;
  }
  :deep(.el-button--primary) .btn-text,
  :deep(.el-button--default) .btn-text {
    display: none;
  }
  :deep(.el-button--primary),
  :deep(.el-button--default) {
    min-width: 36px;
    padding: 0 10px;
  }
  .basemap-select {
    width: 100px;
  }
}
@media (max-width: 680px) {
  .topbar {
    gap: 6px;
  }
  .toolbar-left,
  .toolbar-right {
    gap: 4px;
  }
  .toolbar-right {
    flex: 1 1 auto;
  }
  .toolbar-right .search-panel-toolbar {
    min-width: 0;
    width: auto;
  }
  .basemap-select {
    min-width: 86px;
    width: 86px;
  }
}
@media (max-width: 520px) {
  .toolbar-right .icon-only-btn {
    min-width: 34px;
    padding: 0 7px;
  }
  .engine-switch :deep(.el-button) {
    flex: 0 0 auto;
     white-space: nowrap;
     min-width: 32px !important;
    padding: 0 7px;
  }
  .basemap-select {
    min-width: 72px;
    width: 72px;
  }
}
.brand small {
  display: none;
}
.upload-button {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  height: 24px;
  padding: 0 9px;
  color: #f4fff9;
  border: 1px solid #369a20;
  border-radius: 3px;
  background: #238c14;
  font-size: 12px;
  line-height: 26px;
}
.topbar :deep(.el-button) {
  height: 28px;
  margin: 0;
  border-color: #4a525c;
  border-radius: 3px;
  color: #ecf3fb;
  background: #30363e;
}
.topbar :deep(.el-button:hover) {
  color: #fff;
  border-color: #4e9bd0;
  background: #3b5366;
}
.topbar :deep(.el-button--primary) {
  border-color: #158bd0;
  background: #087dbd;
}
.engine-switch {
  flex: 0 0 auto;
  white-space: nowrap;
}
.engine-switch :deep(.el-button) {
  flex: 0 0 auto;
  white-space: nowrap;
}
.topbar :deep(.el-button-group .el-button) {
  min-width: 35px;
}
.topbar :deep(.el-select__wrapper) {
  min-height: 28px;
  border-radius: 3px;
  background: #30363e;
  box-shadow: 0 0 0 1px #4a525c inset;
}
.basemap-select {
  width: 132px;
  min-width: 100px;
  flex-shrink: 0;
}
.workspace {
  height: auto;
  min-height: 0;
  flex: 1;
  display: block;
}
.map-stage {
  width: 100%;
  height: 100%;
  min-width: 0;
  overflow: hidden;
  background: #0a0d12;
}
.tool-dock {
  position: absolute;
  z-index: 7;
  top: 16px;
  left: 16px;
  width: min(348px, calc(100% - 32px));
  max-height: calc(100% - 64px);
  overflow: hidden;
  border: 1px solid #404850;
  border-radius: 4px;
  background: #252b31;
  box-shadow: 0 12px 30px rgba(0, 0, 0, 0.45);
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
}
.dock-header span::before {
  margin-right: 7px;
  color: #75b8e7;
  content: "▦";
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
.tool-dock .panel {
  min-height: 0;
  margin: 0;
  padding: 14px;
  border: 0;
  border-radius: 0;
  background: #292f35;
}
.tool-dock .layer-workspace-panel {
  padding: 0;
}
.tool-dock .panel-title {
  padding-bottom: 10px;
  border-bottom: 1px solid #3d454e;
}
.tool-dock .empty-state {
  min-height: 150px;
}
.search-panel-toolbar {
  position: relative;
  width: min(360px, 29vw);
  min-width: 180px;
  flex-shrink: 1;
}
.search-panel-toolbar :deep(.el-input) {
  margin: 0;
}
.search-panel-toolbar :deep(.el-input__wrapper) {
  border-radius: 3px;
  background: #30363e;
  box-shadow: 0 0 0 1px #4a525c inset;
}
.search-panel-toolbar .search-results,
.search-panel-toolbar .search-state {
  position: absolute;
  z-index: 10;
  top: 34px;
  right: 0;
  width: min(360px, 46vw);
  margin: 0;
  padding: 7px 10px;
  border: 1px solid #46515c;
  border-radius: 3px;
  background: #242a30;
  box-shadow: 0 10px 20px rgba(0, 0, 0, 0.42);
}
.search-panel-toolbar .search-results {
  max-height: 320px;
  overflow: auto;
  padding-top: 0;
}
.search-panel-toolbar .search-state {
  color: #b7c2cc;
  font-size: 11px;
}
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
.map-stage .map-hint {
  bottom: 38px;
  left: auto;
  right: 16px;
  border-color: #3f4a54;
  border-radius: 3px;
  background: rgba(31, 36, 42, 0.88);
  font-size: 11px;
}
.measurement-badge {
  top: auto;
  bottom: 40px;
  left: 16px;
  border-radius: 3px;
}
.ol-zoom {
  top: 16px;
  right: 16px;
}
.ol-control button {
  border-radius: 2px;
  background: rgba(37, 43, 49, 0.92);
}
</style>
