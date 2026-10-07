<script setup lang="ts">
import { computed } from 'vue';
import type { ToolId } from '@/tools/types';
import { toolTitles } from '@/tools/toolMeta';
import { getToolHost } from './workbenchNavigation';
import { useWorkspaceContext } from '@/tools/workspaceContext';
import { useMapStore } from '@/stores/map';
import WorkbenchToolHost from './WorkbenchToolHost.vue';

const ctx = useWorkspaceContext();
const mapStore = useMapStore();

const selectedLayer = computed(() => mapStore.layers.find((layer) => layer.id === mapStore.selectedLayerId));
const inspectorTool = computed<ToolId | undefined>(() => {
  if (ctx.inspectorTarget.value === 'feature') return 'feature';
  const active = ctx.activeTool.value;
  return ctx.inspectorTarget.value === 'tool' && active && getToolHost(active) === 'inspector' ? active : undefined;
});
const title = computed(() => {
  if (inspectorTool.value) return toolTitles[inspectorTool.value];
  return ctx.inspectorTarget.value === 'layer' ? '图层详情' : '要素详情';
});
/** 工具临时占用右侧时提供返回路径，回落到选中详情。 */
const canBack = computed(() => Boolean(ctx.inspectorTarget.value === 'tool' && ctx.activeTool.value));
function backToSelection() {
  const active = ctx.activeTool.value;
  if (active) ctx.toggleTool(active);
}
</script>

<template>
  <aside v-if="ctx.inspectorTarget.value" class="inspector-panel" :class="{ 'is-above-drawer': Boolean(ctx.bottomDrawerTab.value) }" aria-label="详情面板">
    <header class="inspector-panel__header">
      <button v-if="canBack" type="button" class="inspector-panel__back" aria-label="返回选中详情" title="返回选中详情" @click="backToSelection()">‹</button>
      <div class="inspector-panel__heading">
        <h2>{{ title }}</h2>
      </div>
      <button type="button" aria-label="关闭详情面板" @click="ctx.closeInspector()">×</button>
    </header>

    <div v-if="inspectorTool" class="inspector-panel__body">
      <WorkbenchToolHost :tool="inspectorTool" />
    </div>

    <div v-else class="inspector-panel__body inspector-panel__layer-summary">
      <template v-if="selectedLayer">
        <span class="inspector-panel__kind">{{ selectedLayer.kind }}</span>
        <h3>{{ selectedLayer.name }}</h3>
        <dl>
          <div><dt>要素</dt><dd>{{ selectedLayer.featureCount ?? '—' }}</dd></div>
          <div><dt>状态</dt><dd>{{ selectedLayer.visible ? '可见' : '已隐藏' }}</dd></div>
        </dl>
        <div class="inspector-panel__actions">
          <button type="button" @click="ctx.zoomToLayer(selectedLayer.id)">缩放至图层</button>
          <button type="button" @click="ctx.openTool('vectorStyle')">基础样式</button>
          <button type="button" @click="ctx.openTool('categoryStyle')">分类样式</button>
          <button type="button" @click="ctx.openTool('legend')">图例</button>
          <button type="button" @click="ctx.openTool('timeField')">时间字段</button>
        </div>
      </template>
      <p v-else class="os-muted">选择图层后，在此查看属性与快捷操作</p>
    </div>
  </aside>
</template>

<style scoped>
.inspector-panel { position: absolute; z-index: var(--os-z-panel); top: 12px; right: 12px; bottom: 38px; width: min(var(--os-inspector-width), calc(100% - 24px)); display: flex; flex-direction: column; overflow: hidden; border: 1px solid var(--os-border-subtle); border-radius: var(--os-radius-md); background: var(--os-bg-surface); box-shadow: 0 14px 32px rgb(3 8 14 / 34%); }
.inspector-panel__header { min-height: 52px; display: flex; align-items: center; justify-content: space-between; gap: var(--os-space-3); padding: 8px 8px 8px var(--os-space-4); border-bottom: 1px solid var(--os-border-subtle); background: linear-gradient(90deg, var(--os-bg-surface), var(--os-bg-elevated)); }
.inspector-panel__header p { margin: 0 0 2px; color: var(--os-text-muted); font-size: 10px; letter-spacing: .08em; text-transform: uppercase; }
.inspector-panel__header h2 { margin: 0; font-size: 14px; font-weight: 650; }
.inspector-panel__header button { width: 32px; height: 32px; border: 0; border-radius: 4px; color: var(--os-text-muted); background: transparent; font-size: 20px; cursor: pointer; }
.inspector-panel__header button:hover { color: var(--os-text-primary); background: var(--os-bg-hover); }
.inspector-panel__heading { min-width: 0; flex: 1; }
.inspector-panel.is-above-drawer { bottom: calc(min(290px, 38vh) + 34px); }
.inspector-panel__body { min-height: 0; flex: 1; overflow: auto; }
.inspector-panel__body :deep(.panel) { min-height: 0; margin: 0; border: 0; border-radius: 0; background: transparent; box-shadow: none; }
.inspector-panel__layer-summary { padding: var(--os-space-4); }
.inspector-panel__layer-summary h3 { margin: 6px 0 16px; color: var(--os-text-primary); font-size: 15px; word-break: break-word; }
.inspector-panel__kind { display: inline-block; padding: 2px 6px; border: 1px solid var(--os-border-strong); border-radius: 3px; color: var(--os-text-muted); background: var(--os-bg-elevated); font-size: 10px; text-transform: uppercase; }
.inspector-panel dl { margin: 0; border-top: 1px solid var(--os-border-subtle); }
.inspector-panel dl div { display: flex; justify-content: space-between; gap: 12px; padding: 9px 0; border-bottom: 1px solid var(--os-border-subtle); font-size: 12px; }
.inspector-panel dt { color: var(--os-text-muted); }
.inspector-panel dd { margin: 0; color: var(--os-text-secondary); }
.inspector-panel__actions { display: grid; grid-template-columns: 1fr 1fr; gap: 7px; margin-top: var(--os-space-4); }
.inspector-panel__actions button { min-height: var(--os-control-height); border: 1px solid var(--os-border-strong); border-radius: 4px; color: var(--os-text-secondary); background: var(--os-bg-elevated); font-size: 12px; text-align: left; cursor: pointer; }
.inspector-panel__actions button:hover { color: var(--os-text-primary); border-color: var(--os-accent); background: var(--os-bg-hover); }
@media (max-width: 1023px) { .inspector-panel { bottom: auto; max-height: min(56vh, 520px); } }
@media (max-width: 767px) { .inspector-panel { top: 8px; right: 8px; width: min(var(--os-inspector-width), calc(100% - 16px)); } }
</style>
