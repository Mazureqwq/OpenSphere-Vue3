<script setup lang="ts">
import { computed } from 'vue';
import type { ToolId } from '@/tools/types';
import { toolTitles } from '@/tools/toolMeta';
import { getToolHost } from './workbenchNavigation';
import { useWorkspaceContext } from '@/tools/workspaceContext';
import WorkbenchToolHost from './WorkbenchToolHost.vue';

const ctx = useWorkspaceContext();

const contentTool = computed<ToolId>(() => {
  const active = ctx.activeTool.value;
  return active && getToolHost(active) === 'content' ? active : 'layers';
});
const title = computed(() => ctx.contentTab.value === 'data' ? '数据目录' : toolTitles[contentTool.value]);
</script>

<template>
  <aside v-if="ctx.contentPanelOpen.value" class="content-panel" aria-label="内容和数据">
    <header class="content-panel__header">
      <div class="content-panel__heading">
        <p>工作区</p>
        <h2>{{ title }}</h2>
      </div>
      <div class="content-panel__header-actions">
        <span class="content-panel__status"><i class="os-status-dot"></i>已连接</span>
        <button type="button" class="content-panel__close" aria-label="收起内容面板" @click="ctx.toggleContentPanel()">×</button>
      </div>
    </header>

    <div class="content-panel__body">
      <WorkbenchToolHost :tool="contentTool" :content-mode="ctx.contentTab.value === 'data' ? 'data' : 'content'" />
    </div>
  </aside>
</template>

<style scoped>
.content-panel { z-index: var(--os-z-panel); width: var(--os-panel-width); flex: 0 0 var(--os-panel-width); min-width: 0; display: flex; flex-direction: column; border-right: 1px solid var(--os-border-subtle); background: var(--os-bg-surface); box-shadow: 8px 0 24px rgb(3 8 14 / 16%); }
.content-panel__header { min-height: 56px; flex: 0 0 56px; display: flex; align-items: center; justify-content: space-between; gap: var(--os-space-3); padding-left: var(--os-space-4); border-bottom: 1px solid var(--os-border-subtle); }
.content-panel__heading { min-width: 0; }
.content-panel__heading p { margin: 0 0 3px; color: var(--os-text-muted); font-size: 10px; letter-spacing: .08em; text-transform: uppercase; }
.content-panel h2 { margin: 0; overflow: hidden; color: var(--os-text-primary); text-overflow: ellipsis; white-space: nowrap; font-size: 15px; font-weight: 650; }
.content-panel__header-actions { display: inline-flex; align-items: center; gap: var(--os-space-2); }
.content-panel__status { display: inline-flex; align-items: center; gap: 6px; color: var(--os-text-muted); font-size: 10px; white-space: nowrap; }
.content-panel__close { width: 42px; height: 42px; border: 0; color: var(--os-text-muted); background: transparent; font-size: 20px; cursor: pointer; }
.content-panel__close:hover { color: var(--os-text-primary); background: var(--os-bg-hover); }
.content-panel__body { min-height: 0; flex: 1; overflow: auto; }
.content-panel__body :deep(.panel) { min-height: 0; margin: 0; border: 0; border-radius: 0; background: transparent; box-shadow: none; }
.content-panel__body :deep(.empty-state) { padding-inline: var(--os-space-4); }
@media (max-width: 767px) { .content-panel { position: absolute; top: 0; bottom: 0; left: var(--os-rail-width); width: var(--os-panel-width); box-shadow: 12px 0 28px rgb(3 8 14 / 44%); } .content-panel__status { display: none; } }
</style>
