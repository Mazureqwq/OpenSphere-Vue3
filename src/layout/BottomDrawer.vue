<script setup lang="ts">
import { computed } from 'vue';
import type { ToolId } from '@/tools/types';
import { toolTitles } from '@/tools/toolMeta';
import { getBottomDrawerTabForTool, getToolHost, type BottomDrawerTab } from './workbenchNavigation';
import { useWorkspaceContext } from '@/tools/workspaceContext';
import WorkbenchToolHost from './WorkbenchToolHost.vue';

const ctx = useWorkspaceContext();
const drawerToolByTab: Partial<Record<BottomDrawerTab, ToolId>> = {
  timeline: 'timeline',
  playback: 'playback',
  realtime: 'realtime',
};
const tool = computed<ToolId | undefined>(() => {
  const active = ctx.activeTool.value;
  if (active && getToolHost(active) === 'bottomDrawer' && getBottomDrawerTabForTool(active) === ctx.bottomDrawerTab.value) return active;
  return ctx.bottomDrawerTab.value ? drawerToolByTab[ctx.bottomDrawerTab.value] : undefined;
});
const title = computed(() => tool.value ? toolTitles[tool.value] : '结果');

function selectDrawerTab(tab: BottomDrawerTab) {
  const nextTool = drawerToolByTab[tab];
  if (nextTool) ctx.openTool(nextTool);
  else ctx.openBottomDrawer(tab);
}
function closeDrawer() {
  if (tool.value) ctx.closeActiveTool();
  else ctx.closeBottomDrawer();
}
</script>

<template>
  <section v-if="ctx.bottomDrawerTab.value" class="bottom-drawer" aria-label="底部时间与结果抽屉">
    <header class="bottom-drawer__header">
      <div class="bottom-drawer__title"><span class="bottom-drawer__handle" aria-hidden="true"></span><strong>{{ title }}</strong></div>
      <nav class="bottom-drawer__tabs" aria-label="底部抽屉页签">
        <button v-for="tab in ['timeline', 'playback', 'realtime'] as BottomDrawerTab[]" :key="tab" type="button" :class="{ 'is-active': ctx.bottomDrawerTab.value === tab }" @click="selectDrawerTab(tab)">
          {{ tab === 'timeline' ? '时间轴' : tab === 'playback' ? '回放' : '实时' }}
        </button>
      </nav>
      <button type="button" class="bottom-drawer__close" aria-label="关闭底部抽屉" @click="closeDrawer">×</button>
    </header>
    <div class="bottom-drawer__body">
      <WorkbenchToolHost v-if="tool" :tool="tool" />
      <p v-else class="os-muted">暂无查询结果</p>
    </div>
  </section>
</template>

<style scoped>
.bottom-drawer { position: absolute; z-index: var(--os-z-panel); right: 12px; bottom: 27px; left: 12px; height: min(290px, 38vh); display: flex; flex-direction: column; overflow: hidden; border: 1px solid var(--os-border-subtle); border-radius: var(--os-radius-md) var(--os-radius-md) 0 0; background: var(--os-bg-surface); box-shadow: 0 -10px 30px rgb(3 8 14 / 30%); }
.bottom-drawer__header { min-height: 40px; flex: 0 0 40px; display: flex; align-items: center; justify-content: space-between; gap: var(--os-space-3); padding: 0 8px 0 var(--os-space-3); border-bottom: 1px solid var(--os-border-subtle); background: var(--os-bg-elevated); }
.bottom-drawer__title { min-width: 0; display: flex; align-items: center; gap: 8px; color: var(--os-text-primary); font-size: 12px; }
.bottom-drawer__handle { width: 15px; height: 3px; border-radius: 999px; background: var(--os-border-strong); }
.bottom-drawer__tabs { display: flex; align-self: stretch; gap: 4px; }
.bottom-drawer__tabs button { position: relative; min-width: 56px; border: 0; color: var(--os-text-muted); background: transparent; font-size: 11px; cursor: pointer; }
.bottom-drawer__tabs button:hover { color: var(--os-text-primary); }
.bottom-drawer__tabs button.is-active { color: var(--os-accent-strong); }
.bottom-drawer__tabs button.is-active::after { position: absolute; right: 4px; bottom: 0; left: 4px; height: 2px; background: var(--os-accent); content: ''; }
.bottom-drawer__close { width: 32px; height: 32px; border: 0; border-radius: 4px; color: var(--os-text-muted); background: transparent; font-size: 20px; cursor: pointer; }
.bottom-drawer__close:hover { color: var(--os-text-primary); background: var(--os-bg-hover); }
.bottom-drawer__body { min-height: 0; flex: 1; overflow: auto; }
.bottom-drawer__body :deep(.panel) { min-height: 0; margin: 0; border: 0; border-radius: 0; background: transparent; box-shadow: none; }
.bottom-drawer__body :deep(.timeline-panel) { min-height: 0; }
@media (max-width: 767px) { .bottom-drawer { right: 8px; bottom: 27px; left: 8px; height: min(250px, 40vh); } .bottom-drawer__tabs button { min-width: 48px; } }
</style>
