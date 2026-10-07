<script setup lang="ts">
import { computed } from 'vue';
import { Delete, FolderOpened, Location, MoreFilled } from '@element-plus/icons-vue';
import SearchPanel from '@/components/SearchPanel.vue';
import { useMapStore } from '@/stores/map';
import { useWorkspaceContext } from '@/tools/workspaceContext';

const mapStore = useMapStore();
const ctx = useWorkspaceContext();

const sectionTitle = computed(() => ({
  content: '内容',
  data: '数据',
  edit: '编辑',
  analysis: '分析',
  time: '时间',
  monitor: '监测',
})[ctx.activeSection.value]);

function onBaseMapChange(id: string) {
  mapStore.setBaseMap(id);
  ctx.handleBaseMapChange();
}

function importFiles(event: Event) {
  const input = event.target as HTMLInputElement;
  void ctx.handleFiles(input.files);
  input.value = '';
}
</script>

<template>
  <header class="atlas-topbar">
    <div class="atlas-topbar__identity">
      <div class="atlas-brand" aria-label="OpenSphere">
        <span class="atlas-brand__mark" aria-hidden="true"><i></i><i></i></span>
        <span>OpenSphere</span>
      </div>
      <span class="atlas-topbar__divider" aria-hidden="true"></span>
      <div class="atlas-topbar__context"><span>{{ sectionTitle }}</span><small>专业工作台</small></div>
    </div>

    <div class="atlas-topbar__actions">
      <label class="atlas-import-button">
        <el-icon><FolderOpened /></el-icon><span>导入</span>
        <input type="file" accept=".geojson,.json,.csv,.kml,.kmz,.gpx,.zip" multiple @change="importFiles" />
      </label>
      <el-dropdown trigger="click">
        <el-button size="small" :icon="MoreFilled"><span class="atlas-more-label">工作区</span></el-button>
        <template #dropdown>
          <el-dropdown-menu>
            <el-dropdown-item @click="ctx.openSection('content')">内容与图层</el-dropdown-item>
            <el-dropdown-item @click="ctx.openSection('data')">数据目录</el-dropdown-item>
            <el-dropdown-item @click="ctx.openSection('edit')">绘制与编辑</el-dropdown-item>
            <el-dropdown-item @click="ctx.openSection('analysis')">空间分析</el-dropdown-item>
            <el-dropdown-item @click="ctx.openSection('time')">时间轴</el-dropdown-item>
            <el-dropdown-item @click="ctx.openSection('monitor')">实时监测</el-dropdown-item>
            <el-dropdown-item divided @click="ctx.openTool('visualization')">点位展示与聚合</el-dropdown-item>
            <el-dropdown-item @click="ctx.openTool('coordinate')">坐标定位</el-dropdown-item>
            <el-dropdown-item @click="ctx.openTool('vectorStyle')">基础样式</el-dropdown-item>
            <el-dropdown-item @click="ctx.openTool('categoryStyle')">分类样式</el-dropdown-item>
            <el-dropdown-item @click="ctx.openTool('legend')">图例</el-dropdown-item>
            <el-dropdown-item @click="ctx.openTool('timeField')">时间字段</el-dropdown-item>
            <el-dropdown-item @click="ctx.openTool('feature')">要素信息</el-dropdown-item>
            <el-dropdown-item @click="ctx.openTool('playback')">轨迹回放</el-dropdown-item>
            <el-dropdown-item divided @click="ctx.showWmsDialog.value = true">添加 WMS 图层</el-dropdown-item>
            <el-dropdown-item @click="ctx.saveWorkspaceNow()">保存当前工作区</el-dropdown-item>
            <el-dropdown-item @click="ctx.restoreWorkspaceState()">恢复已保存工作区</el-dropdown-item>
            <el-dropdown-item divided @click="ctx.clearWorkspaceState()"><el-icon><Delete /></el-icon>清空工作区</el-dropdown-item>
          </el-dropdown-menu>
        </template>
      </el-dropdown>
    </div>

    <div class="atlas-topbar__map-actions">
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
        <el-button size="small" :icon="Location" class="atlas-icon-button" aria-label="坐标定位" @click="ctx.openTool('coordinate')" />
      </el-tooltip>
      <el-button-group class="atlas-engine-switch">
        <el-button size="small" :type="mapStore.mapEngine === '2d' ? 'primary' : 'default'" @click="mapStore.setMapEngine('2d')">2D</el-button>
        <el-button size="small" :type="mapStore.mapEngine === '3d' ? 'primary' : 'default'" @click="mapStore.setMapEngine('3d')">3D</el-button>
      </el-button-group>
      <el-select class="atlas-basemap-select" size="small" :model-value="mapStore.activeBaseMapId" @update:model-value="onBaseMapChange">
        <el-option v-for="item in mapStore.baseMaps" :key="item.id" :label="item.name" :value="item.id" />
      </el-select>
    </div>
  </header>
</template>

<style scoped>
.atlas-topbar { position: relative; z-index: var(--os-z-popover); height: 52px; flex: 0 0 52px; display: grid; grid-template-columns: minmax(230px, auto) auto minmax(260px, 1fr); align-items: center; gap: var(--os-space-3); padding: 0 var(--os-space-3); border-bottom: 1px solid var(--os-border-subtle); background: var(--os-bg-shell); }
.atlas-topbar__identity, .atlas-topbar__actions, .atlas-topbar__map-actions { min-width: 0; display: flex; align-items: center; gap: var(--os-space-2); }
.atlas-topbar__map-actions { justify-content: flex-end; }
.atlas-brand { display: inline-flex; align-items: center; gap: 8px; color: var(--os-text-primary); font-size: 15px; font-weight: 700; letter-spacing: .01em; }
.atlas-brand__mark { position: relative; width: 20px; height: 20px; display: inline-block; border: 2px solid var(--os-accent-strong); border-radius: 50%; }
.atlas-brand__mark i { position: absolute; top: 3px; bottom: 3px; width: 2px; border-radius: 2px; background: var(--os-accent-strong); transform: rotate(38deg); }
.atlas-brand__mark i:first-child { left: 6px; }.atlas-brand__mark i:last-child { right: 6px; transform: rotate(-38deg); }
.atlas-topbar__divider { width: 1px; height: 22px; background: var(--os-border-subtle); }
.atlas-topbar__context { display: flex; flex-direction: column; gap: 1px; color: var(--os-text-secondary); font-size: 12px; line-height: 1.1; }
.atlas-topbar__context small { color: var(--os-text-muted); font-size: 10px; }
.atlas-import-button { min-height: var(--os-compact-control-height); display: inline-flex; align-items: center; gap: 5px; padding: 0 9px; border: 1px solid #2d8a63; border-radius: 4px; color: #e9fff5; background: #19734e; font-size: 12px; cursor: pointer; }
.atlas-import-button:hover { border-color: #49bd8a; background: #1e8059; }
.atlas-import-button input { display: none; }
.atlas-topbar__map-actions :deep(.search-panel-toolbar) { position: relative; width: min(340px, 28vw); min-width: 160px; }
.atlas-topbar__map-actions :deep(.search-results), .atlas-topbar__map-actions :deep(.search-state) { position: absolute; z-index: var(--os-z-popover); top: 34px; right: 0; width: min(380px, 48vw); }
.atlas-icon-button { width: var(--os-compact-control-height); padding-inline: 0; }
.atlas-engine-switch { flex: 0 0 auto; white-space: nowrap; }
.atlas-basemap-select { width: 132px; flex: 0 0 132px; }
@media (max-width: 1100px) { .atlas-topbar { grid-template-columns: auto auto minmax(180px, 1fr); } .atlas-topbar__context small, .atlas-more-label { display: none; } .atlas-topbar__map-actions :deep(.search-panel-toolbar) { width: min(250px, 25vw); } }
@media (max-width: 800px) { .atlas-topbar { gap: 6px; padding-inline: 8px; } .atlas-brand span:last-child, .atlas-topbar__divider, .atlas-topbar__context { display: none; } .atlas-import-button span { display: none; } .atlas-import-button { width: var(--os-compact-control-height); justify-content: center; padding: 0; } .atlas-topbar__map-actions :deep(.search-panel-toolbar) { width: min(220px, 30vw); min-width: 100px; } .atlas-basemap-select { width: 104px; flex-basis: 104px; } }
@media (max-width: 620px) { .atlas-topbar { grid-template-columns: auto auto 1fr; } .atlas-topbar__map-actions :deep(.search-panel-toolbar) { width: auto; min-width: 0; flex: 1; } .atlas-basemap-select { display: none; } .atlas-engine-switch :deep(.el-button) { min-width: 30px; padding-inline: 6px; } }
</style>
