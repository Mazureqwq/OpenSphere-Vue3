<script setup lang="ts">
import {
  computed,
  nextTick,
  onBeforeUnmount,
  onMounted,
  ref,
  toRaw,
  watch,
} from "vue";
import { ElMessage, ElMessageBox } from "element-plus";
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
import {
  createDrawingLayer as createDrawingRecord,
  type DrawMode,
} from "@/map/drawing";
import {
  importCsv,
  importGeoJson,
  importGpx,
  importKml,
  importKmz,
  importShapefile,
} from "@/map/importers";
import { createWmsLayer, type WmsLayerInput } from "@/map/ogc";
import {
  createRealtimeLayer,
  RealtimeTrackService,
  type RealtimeStatus,
} from "@/map/realtime";
import {
  buildPlaybackTracks,
  getPlaybackPosition,
  TrackPlaybackController,
  type PlaybackTrack,
  type TrackPlaybackState,
} from "@/map/trackPlayback";
import { SearchService } from "@/search/SearchService";
import type { SearchResult } from "@/search/types";
import { useMapStore } from "@/stores/map";
import {
  clearWorkspace,
  createSnapshot,
  loadWorkspace,
  restoreLayers,
  saveWorkspace,
} from "@/workspace";
import type {
  BaseMapOption,
  LayerRecord,
  PointVisualizationConfig,
} from "@/types/gis";
import type { MapViewState } from "@/types/workspace";

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
  clearCoordinateLocation: () => void;
}>();
const showWmsDialog = ref(false);
const workspaceReady = ref(false);
const currentView = ref<MapViewState>({
  center: [113.6254, 34.7466],
  zoom: 5,
  rotation: 0,
});
const measurement = ref<string>();
const searchResults = ref<SearchResult[]>([]);
const searchLoading = ref(false);
const searchService = new SearchService();
let searchSequence = 0;
let saveTimer: ReturnType<typeof setTimeout> | undefined;
const playbackTracks = ref<PlaybackTrack[]>([]);
const playbackState = ref<TrackPlaybackState>({ playing: false, speed: 1 });
const playbackFollow = ref(false);
let playbackSourceLayerId: string | undefined;
const playbackController = new TrackPlaybackController((state) => {
  playbackState.value = state;
  renderTrackPlayback();
});
const realtimeStatus = ref<RealtimeStatus>("disconnected");
const realtimeTrackCount = ref(0);
const realtimeLastUpdated = ref<string>();
const realtimeError = ref<string>();
let realtimeLayerId: string | undefined;
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
const realtimeService = new RealtimeTrackService(
  (state) => {
    realtimeStatus.value = state.status;
    realtimeTrackCount.value = state.trackCount;
    realtimeLastUpdated.value = state.lastUpdated;
    realtimeError.value = state.error;
    if (realtimeLayerId) mapStore.refreshFeatureCount(realtimeLayerId);
  },
  (layer) => mapView.value?.syncRealtimeLayer(layer),
);

type ImportHandler = (file: File) => Promise<LayerRecord>;
const importers: Record<string, ImportHandler> = {
  csv: importCsv,
  geojson: importGeoJson,
  json: importGeoJson,
  kml: importKml,
  kmz: importKmz,
  gpx: importGpx,
  zip: importShapefile,
};
const workspaceState = computed(() => ({
  baseMapId: mapStore.activeBaseMapId,
  selectedLayerId: mapStore.selectedLayerId,
  timeEnabled: mapStore.timeEnabled,
  timeCursor: mapStore.timeCursor,
  timeRange: mapStore.timeRange,
  query: mapStore.query,
  layers: mapStore.layers
    .filter((layer) => !layer.realtime)
    .map((layer) => ({
      id: layer.id,
      visible: layer.visible,
      opacity: layer.opacity,
      vectorStyle: layer.vectorStyle,
      categoryStyle: layer.categoryStyle,
      timeFilter: layer.timeFilter,
      drawing: layer.drawing,
      featureCount: layer.featureCount,
    })),
}));

onMounted(async () => {
  await nextTick();
  restoreWorkspaceState(false);
  workspaceReady.value = true;
});
onBeforeUnmount(() => {
  if (saveTimer) clearTimeout(saveTimer);
  searchService.dispose();
  realtimeService.dispose();
  playbackController.dispose();
});

watch(workspaceState, () => scheduleWorkspaceSave(), { deep: true });

async function handleFiles(files: FileList | null) {
  if (!files?.length) return;
  for (const file of Array.from(files)) {
    const extension = file.name.split(".").pop()?.toLowerCase();
    const importer = extension ? importers[extension] : undefined;
    if (!importer) {
      ElMessage.warning(`${file.name} 不是支持的空间文件格式`);
      continue;
    }
    try {
      if (extension === "zip" || extension === "kmz")
        ElMessage.info(`正在后台解析 ${file.name}`);
      const layer = await importer(file);
      addLayer(layer, true);
      ElMessage.success(`已导入 ${file.name}，地图已定位到数据范围`);
    } catch (error) {
      ElMessage.error(error instanceof Error ? error.message : "文件导入失败");
    }
  }
}
function addLayer(layer: LayerRecord, zoomToLayer = false) {
  mapStore.addLayer(layer);
  mapView.value?.addLayer(layer, zoomToLayer);
}

function addWmsLayer(input: WmsLayerInput) {
  addLayer(createWmsLayer(input));
  ElMessage.success(`已添加 WMS 图层：${input.name}`);
}

function handleBaseMapChange() {
  mapView.value?.setBaseMap(mapStore.activeBaseMap);
}
function toggleTool(tool: ToolId) {
  activeTool.value = activeTool.value === tool ? undefined : tool;
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
async function search(term: string) {
  const sequence = ++searchSequence;
  searchLoading.value = true;
  const { results } = await searchService.search(term, {
    layers: mapStore.layers.map(
      (layer) => toRaw(layer) as unknown as LayerRecord,
    ),
    view: mapView.value?.getViewState() ?? currentView.value,
    limit: 12,
  });
  if (sequence !== searchSequence) return;
  searchResults.value = results;
  searchLoading.value = false;
}
function clearSearch() {
  searchSequence += 1;
  searchLoading.value = false;
  searchResults.value = [];
  searchService.dispose();
}
function selectSearchResult(result: SearchResult) {
  const [longitude, latitude] = result.coordinate;
  if (!Number.isFinite(longitude) || !Number.isFinite(latitude)) {
    ElMessage.warning("该搜索结果不包含可用坐标");
    return;
  }
  locateCoordinate(result.coordinate);
}
function renderTrackPlayback() {
  const track = playbackTracks.value.find(
    (item) => item.id === playbackState.value.trackId,
  );
  const timestamp = playbackState.value.currentTime;
  if (!track || timestamp === undefined || !playbackSourceLayerId) {
    mapView.value?.clearTrackPlayback();
    return;
  }
  mapView.value?.setTrackPlayback(
    playbackSourceLayerId,
    track,
    getPlaybackPosition(track, timestamp),
    playbackFollow.value,
  );
}
function loadTrackPlayback(
  layerId: string,
  idField: string,
  timeField: string,
) {
  const layer = mapStore.layers.find((item) => item.id === layerId);
  if (!layer?.vectorStyle) {
    ElMessage.warning("请选择包含点要素的矢量图层");
    return;
  }
  const tracks = buildPlaybackTracks(
    toRaw(layer) as unknown as LayerRecord,
    idField,
    timeField,
  );
  if (!tracks.length) {
    ElMessage.warning("未解析到至少含两个不同时刻点位的轨迹");
    return;
  }
  playbackSourceLayerId = layer.id;
  playbackTracks.value = tracks;
  playbackController.load(tracks);
  mapStore.selectedLayerId = layer.id;
  ElMessage.success(`已解析 ${tracks.length} 条可回放轨迹`);
}
function setPlaybackFollow(value: boolean) {
  playbackFollow.value = value;
  renderTrackPlayback();
}
function clearTrackPlayback() {
  playbackController.clear();
  playbackTracks.value = [];
  playbackSourceLayerId = undefined;
  mapView.value?.clearTrackPlayback();
}
function applyPointVisualization(
  layerId: string,
  config: PointVisualizationConfig,
) {
  const layer = mapStore.layers.find((item) => item.id === layerId);
  if (!layer?.vectorStyle) {
    ElMessage.warning("请选择包含点要素的矢量图层");
    return;
  }
  const applied =
    mapView.value?.setPointVisualization(
      toRaw(layer) as unknown as LayerRecord,
      config,
    ) ?? false;
  if (!applied) {
    ElMessage.warning("当前图层没有可用于展示的点要素");
    return;
  }
  mapStore.selectedLayerId = layer.id;
  ElMessage.success(
    config.mode === "heatmap" ? "已应用热力展示" : "已应用聚合气泡展示",
  );
}
function clearPointVisualization() {
  mapView.value?.clearPointVisualization();
  ElMessage.info("已恢复原始点位展示");
}
function ensureRealtimeLayer() {
  const existing = realtimeLayerId
    ? mapStore.layers.find((layer) => layer.id === realtimeLayerId)
    : undefined;
  if (existing) return toRaw(existing) as unknown as LayerRecord;
  const layer = createRealtimeLayer();
  addLayer(layer);
  realtimeLayerId = layer.id;
  realtimeService.attachLayer(layer);
  return layer;
}
function connectRealtime(url: string) {
  const layer = ensureRealtimeLayer();
  try {
    realtimeService.connect(url);
    mapStore.selectedLayerId = layer.id;
  } catch (error) {
    ElMessage.error(
      error instanceof Error ? error.message : "WebSocket 连接失败",
    );
  }
}
function startRealtimeSimulation() {
  const layer = ensureRealtimeLayer();
  realtimeService.startSimulation();
  mapStore.selectedLayerId = layer.id;
}
function stopRealtimeTracking() {
  realtimeService.detachLayer();
  realtimeLayerId = undefined;
}
function handleRemoveLayer(id: string) {
  const layer = mapStore.layers.find((item) => item.id === id);
  if (layer?.drawing) mapView.value?.setDrawMode();
  if (layer?.realtime) stopRealtimeTracking();
  if (layer?.id === playbackSourceLayerId) clearTrackPlayback();
  mapView.value?.removeLayer(id);
  mapStore.removeLayer(id);
}
function handleViewChange(state: MapViewState) {
  currentView.value = state;
  scheduleWorkspaceSave();
}
function createDrawingLayer() {
  const existing = mapStore.layers.find((layer) => layer.drawing);
  if (existing) {
    mapStore.selectedLayerId = existing.id;
    ElMessage.info("绘制图层已存在");
    return;
  }
  addLayer(createDrawingRecord());
  ElMessage.success("已创建绘制图层");
}
function setDrawMode(mode: DrawMode) {
  const layer = mapStore.layers.find((item) => item.drawing);
  if (!layer) {
    ElMessage.warning("请先创建绘制图层");
    return;
  }
  mapStore.selectedLayerId = layer.id;
  mapView.value?.setDrawMode(mode, toRaw(layer) as unknown as LayerRecord);
}
function stopDrawing() {
  mapView.value?.setDrawMode();
  measurement.value = undefined;
}
function deleteSelectedDrawingFeatures() {
  const layer = mapStore.layers.find((item) => item.drawing);
  const deleted =
    mapView.value?.deleteSelectedDrawingFeatures(
      layer ? (toRaw(layer) as unknown as LayerRecord) : undefined,
    ) ?? 0;
  if (!deleted) {
    ElMessage.info("请先点击选中绘制要素");
    return;
  }
  if (layer) mapStore.refreshFeatureCount(layer.id);
  ElMessage.success(`已删除 ${deleted} 个绘制要素`);
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
  const layer = mapStore.layers.find((item) => item.drawing);
  if (layer) mapStore.refreshFeatureCount(layer.id);
  scheduleWorkspaceSave();
}

function persistWorkspace() {
  const view = mapView.value?.getViewState() ?? currentView.value;
  saveWorkspace(
    createSnapshot({
      baseMapId: mapStore.activeBaseMapId,
      selectedLayerId: mapStore.selectedLayerId,
      timeEnabled: mapStore.timeEnabled,
      timeCursor: mapStore.timeCursor,
      timeRange: mapStore.timeRange,
      query: mapStore.query,
      view,
      layers: mapStore.layers.map(
        (layer) => toRaw(layer) as unknown as LayerRecord,
      ),
    }),
  );
}

function scheduleWorkspaceSave() {
  if (!workspaceReady.value) return;
  if (saveTimer) clearTimeout(saveTimer);
  saveTimer = setTimeout(persistWorkspace, 400);
}

function saveWorkspaceNow() {
  persistWorkspace();
  ElMessage.success("工作区已保存到当前浏览器");
}

function restoreWorkspaceState(notify = true) {
  const snapshot = loadWorkspace();
  if (!snapshot) {
    if (notify) ElMessage.info("未找到已保存的工作区");
    return;
  }

  workspaceReady.value = false;
  stopRealtimeTracking();
  clearTrackPlayback();
  mapView.value?.clearLayers();
  mapStore.clearLayers();
  mapStore.setBaseMap(snapshot.baseMapId);
  mapStore.timeEnabled = snapshot.timeEnabled;
  mapStore.timeCursor = snapshot.timeCursor;
  mapStore.setTimeRange(snapshot.timeRange);
  mapStore.setQuery(snapshot.query);
  mapStore.selectedLayerId = snapshot.selectedLayerId;
  mapView.value?.setBaseMap(mapStore.activeBaseMap);

  try {
    const restored = restoreLayers(snapshot);
    mapStore.replaceLayers(restored);
    mapStore.refreshFilters();
    restored.forEach((layer) => mapView.value?.addLayer(layer));
    currentView.value = snapshot.view;
    mapView.value?.setViewState(snapshot.view);
    if (notify) ElMessage.success(`已恢复工作区：${restored.length} 个图层`);
  } catch (error) {
    ElMessage.error(
      error instanceof Error
        ? `工作区恢复失败：${error.message}`
        : "工作区恢复失败",
    );
  } finally {
    workspaceReady.value = true;
  }
}

async function clearWorkspaceState() {
  await ElMessageBox.confirm(
    "这将移除浏览器保存的工作区，并清空当前地图中的业务图层。",
    "清空工作区",
    { confirmButtonText: "清空", cancelButtonText: "取消", type: "warning" },
  );
  clearWorkspace();
  stopRealtimeTracking();
  clearTrackPlayback();
  mapView.value?.clearLayers();
  mapStore.clearLayers();
  ElMessage.success("工作区已清空");
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
          @measurement-change="(value) => (measurement = value)"
          @drawing-change="handleDrawingChange" />
        <aside v-if="activeTool" class="tool-dock">
          <header class="dock-header">
            <span>{{ toolTitles[activeTool] }}</span
            ><button
              type="button"
              aria-label="关闭工具面板"
              @click="activeTool = undefined">
              ×
            </button>
          </header>
          <div class="dock-content">
            <LayerWorkspacePanel
              v-if="activeTool === 'layers'"
              :view="currentView"
              @remove="handleRemoveLayer"
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
              @disconnect="realtimeService.disconnect()"
              @start-simulation="startRealtimeSimulation"
              @stop-simulation="
                realtimeService.stopSimulation()
              " /><PointVisualizationPanel
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
              @select-track="playbackController.selectTrack"
              @play="playbackController.play"
              @pause="playbackController.pause"
              @seek="playbackController.setTime"
              @speed="playbackController.setSpeed"
              @follow="setPlaybackFollow"
              @clear="clearTrackPlayback" /><DrawingPanel
              v-else-if="activeTool === 'drawing'"
              @create="createDrawingLayer"
              @mode="setDrawMode"
              @stop="stopDrawing"
              @remove-selected="deleteSelectedDrawingFeatures" /><QueryPanel
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
            >{{ currentView.center[0].toFixed(5) }},
            {{ currentView.center[1].toFixed(5) }}</span
          ><span>{{ mapStore.activeBaseMap.name }}</span>
        </footer>
      </section>
    </main>
    <WmsLayerDialog v-model="showWmsDialog" @submit="addWmsLayer" />
  </div>
</template>
