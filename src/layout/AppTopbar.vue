<script setup lang="ts">
import {
  Collection,
  Delete,
  EditPen,
  FolderOpened,
  Location,
  MoreFilled,
  Timer,
} from '@element-plus/icons-vue';
import SearchPanel from '@/components/SearchPanel.vue';
import { useMapStore } from '@/stores/map';
import { useWorkspaceContext } from '@/tools/workspaceContext';

const mapStore = useMapStore();
const ctx = useWorkspaceContext();

function onBaseMapChange(id: string) {
  mapStore.setBaseMap(id);
  ctx.handleBaseMapChange();
}
</script>

<template>
  <header class="topbar">
    <div class="toolbar-left">
      <div class="brand">
        <span class="brand-mark">◎</span><span>OpenSphere</span>
      </div>
      <label class="upload-button">
        <el-icon><FolderOpened /></el-icon><span>导入</span>
        <input
          type="file"
          accept=".geojson,.json,.csv,.kml,.kmz,.gpx,.zip"
          multiple
          @change="ctx.handleFiles(($event.target as HTMLInputElement).files)"
        />
      </label>
      <el-button
        size="small"
        :type="ctx.activeTool.value === 'layers' ? 'primary' : 'default'"
        :icon="Collection"
        @click="ctx.toggleTool('layers')"
      >图层</el-button>
      <el-button
        size="small"
        :type="ctx.activeTool.value === 'drawing' ? 'primary' : 'default'"
        :icon="EditPen"
        @click="ctx.toggleTool('drawing')"
      >绘制</el-button>
      <el-button
        size="small"
        :type="ctx.activeTool.value === 'timeline' ? 'primary' : 'default'"
        :icon="Timer"
        @click="ctx.toggleTool('timeline')"
      >时间轴</el-button>
      <el-dropdown trigger="click" class="more-dropdown">
        <el-button size="small" :icon="MoreFilled"><span class="more-label">更多</span></el-button>
        <template #dropdown>
          <el-dropdown-menu>
            <el-dropdown-item @click="ctx.toggleTool('query')">空间查询</el-dropdown-item>
            <el-dropdown-item @click="ctx.toggleTool('visualization')">热力图与聚合</el-dropdown-item>
            <el-dropdown-item @click="ctx.toggleTool('realtime')">实时轨迹</el-dropdown-item>
            <el-dropdown-item @click="ctx.toggleTool('playback')">轨迹回放</el-dropdown-item>
            <el-dropdown-item @click="ctx.toggleTool('coordinate')">坐标定位</el-dropdown-item>
            <el-dropdown-item divided @click="ctx.toggleTool('vectorStyle')">基础样式</el-dropdown-item>
            <el-dropdown-item @click="ctx.toggleTool('categoryStyle')">分类样式</el-dropdown-item>
            <el-dropdown-item @click="ctx.toggleTool('legend')">图例</el-dropdown-item>
            <el-dropdown-item @click="ctx.toggleTool('timeField')">时间字段</el-dropdown-item>
            <el-dropdown-item @click="ctx.toggleTool('feature')">要素信息</el-dropdown-item>
            <el-dropdown-item divided @click="ctx.showWmsDialog.value = true">添加 WMS 图层</el-dropdown-item>
            <el-dropdown-item @click="ctx.saveWorkspaceNow()">保存当前工作区</el-dropdown-item>
            <el-dropdown-item @click="ctx.restoreWorkspaceState()">恢复已保存工作区</el-dropdown-item>
            <el-dropdown-item divided @click="ctx.clearWorkspaceState()">
              <el-icon><Delete /></el-icon>清空工作区
            </el-dropdown-item>
          </el-dropdown-menu>
        </template>
      </el-dropdown>
    </div>
    <div class="toolbar-right">
      <SearchPanel
        variant="toolbar"
        :results="ctx.searchResults.value"
        :loading="ctx.searchLoading.value"
        :providers="ctx.searchProviderNames"
        @search="ctx.search"
        @select="ctx.selectSearchResult"
        @clear="ctx.clearSearch"
      />
      <el-tooltip content="坐标定位" placement="bottom">
        <el-button size="small" :icon="Location" class="icon-only-btn" @click="ctx.toggleTool('coordinate')">
          <span class="btn-text">定位</span>
        </el-button>
      </el-tooltip>
      <el-button-group class="engine-switch">
        <el-button size="small" :type="mapStore.mapEngine === '2d' ? 'primary' : 'default'" @click="mapStore.setMapEngine('2d')">2D</el-button>
        <el-button size="small" :type="mapStore.mapEngine === '3d' ? 'primary' : 'default'" @click="mapStore.setMapEngine('3d')">3D</el-button>
      </el-button-group>
      <el-select class="basemap-select" size="small" :model-value="mapStore.activeBaseMapId" @update:model-value="onBaseMapChange">
        <el-option v-for="item in mapStore.baseMaps" :key="item.id" :label="item.name" :value="item.id" />
      </el-select>
    </div>
  </header>
</template>

<style scoped>
.topbar {
  position: relative;
  z-index: 20;
  height: 48px;
  flex: 0 0 48px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 0 8px;
  border-bottom: 1px solid #3b4047;
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
.toolbar-left { flex: 0 1 auto; }
.toolbar-right { justify-content: flex-end; }
.toolbar-right .search-panel-toolbar { flex: 1 1 360px; }
.brand {
  display: inline-flex;
  align-items: center;
  flex: 0 0 auto;
  gap: 6px;
  padding-right: 7px;
  color: #f2f6fa;
  font-size: 15px;
  font-weight: 700;
}
.brand-mark { font-size: 21px; }
.toolbar-left .icon-only-btn .btn-text,
.toolbar-right .icon-only-btn .btn-text { display: inline; }
@media (max-width: 1100px) {
  .toolbar-left .icon-only-btn .btn-text,
  .toolbar-right .icon-only-btn .btn-text { display: none; }
  .toolbar-left .icon-only-btn,
  .toolbar-right .icon-only-btn { padding: 0 8px; min-width: 36px; }
  .more-dropdown :deep(.el-button) { padding: 0 10px; }
}
@media (max-width: 800px) {
  .topbar { gap: 8px; padding: 0 6px; }
  .brand span:last-child { display: none; }
  .upload-button span { display: none; }
  .more-label { display: none; }
  :deep(.el-button--primary) .btn-text,
  :deep(.el-button--default) .btn-text { display: none; }
  :deep(.el-button--primary),
  :deep(.el-button--default) { min-width: 36px; padding: 0 10px; }
  .basemap-select { width: 100px; }
}
@media (max-width: 680px) {
  .topbar { gap: 6px; }
  .toolbar-left, .toolbar-right { gap: 4px; }
  .toolbar-right { flex: 1 1 auto; }
  .toolbar-right .search-panel-toolbar { min-width: 0; width: auto; }
  .basemap-select { min-width: 86px; width: 86px; }
}
@media (max-width: 520px) {
  .toolbar-right .icon-only-btn { min-width: 34px; padding: 0 7px; }
  .engine-switch :deep(.el-button) {
    flex: 0 0 auto;
    white-space: nowrap;
    min-width: 32px !important;
    padding: 0 7px;
  }
  .basemap-select { min-width: 72px; width: 72px; }
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
  cursor: pointer;
}
.upload-button input { display: none; }
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
.engine-switch { flex: 0 0 auto; white-space: nowrap; }
.engine-switch :deep(.el-button) { flex: 0 0 auto; white-space: nowrap; }
.topbar :deep(.el-button-group .el-button) { min-width: 35px; }
.topbar :deep(.el-select__wrapper) {
  min-height: 28px;
  border-radius: 3px;
  background: #30363e;
  box-shadow: 0 0 0 1px #4a525c inset;
}
.basemap-select { width: 132px; min-width: 100px; flex-shrink: 0; }
.search-panel-toolbar {
  position: relative;
  width: min(360px, 29vw);
  min-width: 180px;
  flex-shrink: 1;
}
.search-panel-toolbar :deep(.el-input) { margin: 0; }
.search-panel-toolbar :deep(.el-input__wrapper) {
  border-radius: 3px;
  background: #30363e;
  box-shadow: 0 0 0 1px #4a525c inset;
}
.search-panel-toolbar :deep(.search-results),
.search-panel-toolbar :deep(.search-state) {
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
.search-panel-toolbar :deep(.search-results) {
  max-height: 320px;
  overflow: auto;
  padding-top: 0;
}
.search-panel-toolbar :deep(.search-state) {
  color: #b7c2cc;
  font-size: 11px;
}
</style>
