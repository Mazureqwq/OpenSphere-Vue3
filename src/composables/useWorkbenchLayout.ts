import { computed, ref, watch, type ComputedRef, type Ref } from 'vue';
import type { ToolId } from '../tools/toolMeta.ts';
import {
  getBottomDrawerTabForTool,
  getContentTabForSection,
  getSectionForTool,
  getSectionRoute,
  getToolHost,
  type BottomDrawerTab,
  type ContentTab,
  type InspectorTarget,
  type WorkbenchSection,
} from '../layout/workbenchNavigation.ts';
import type { SelectionTarget } from '../stores/selection';

export interface WorkbenchToolController {
  activeTool: Ref<ToolId | undefined>;
  openTool: (tool: ToolId) => void;
  toggleTool: (tool: ToolId) => void;
  closeTool: () => void;
}

/** 统一选中控制器（生产环境由 selection store 提供，测试可注入假实现）。 */
export interface WorkbenchSelectionController {
  current: ComputedRef<SelectionTarget | null> | Ref<SelectionTarget | null>;
  clear: () => void;
}

export interface WorkbenchLayoutOptions extends WorkbenchToolController {
  selection: WorkbenchSelectionController;
}

export function useWorkbenchLayout(options: WorkbenchLayoutOptions) {
  const initialTool = options.activeTool.value ?? 'layers';
  const activeSection = ref<WorkbenchSection>(getSectionForTool(initialTool));
  const contentTab = ref<ContentTab>(getContentTabForSection(activeSection.value) ?? 'layers');
  const contentPanelOpen = ref(getToolHost(initialTool) === 'content');
  const bottomDrawerTab = ref<BottomDrawerTab | undefined>(getBottomDrawerTabForTool(initialTool));
  // 三区契约：右侧只承载「选中检查」；inspector 型工具打开时临时占用右侧，关闭后回落到选中检查。
  const toolInspectorTool = ref<ToolId>();
  let pinnedSection: { tool: ToolId; section: WorkbenchSection } | undefined;

  const inspectorTarget = computed<InspectorTarget>(() => {
    if (toolInspectorTool.value) return 'tool';
    const kind = options.selection.current.value?.kind;
    if (kind === 'feature') return 'feature';
    if (kind === 'incident') return 'incident';
    if (kind === 'layer') return 'layer';
    return undefined;
  });

  function syncTool(tool: ToolId, sectionOverride?: WorkbenchSection) {
    const host = getToolHost(tool);
    activeSection.value = sectionOverride ?? getSectionForTool(tool);
    const nextContentTab = getContentTabForSection(activeSection.value);
    if (nextContentTab) contentTab.value = nextContentTab;

    if (host === 'inspector') {
      toolInspectorTool.value = tool;
      return;
    }
    toolInspectorTool.value = undefined;
    if (host === 'content') {
      contentPanelOpen.value = true;
      // 切换左侧工具不打断底部数据流（回放/实时继续）
      return;
    }
    bottomDrawerTab.value = getBottomDrawerTabForTool(tool);
  }

  function releaseToolRegions(tool: ToolId) {
    const host = getToolHost(tool);
    if (host === 'bottomDrawer') bottomDrawerTab.value = undefined;
    if (host === 'inspector' && toolInspectorTool.value === tool) toolInspectorTool.value = undefined;
  }

  function openSection(section: WorkbenchSection) {
    const route = getSectionRoute(section);
    pinnedSection = { tool: route.tool, section };
    options.openTool(route.tool);
    syncTool(route.tool, section);
  }

  function openWorkbenchTool(tool: ToolId) {
    options.openTool(tool);
    syncTool(tool);
  }

  function toggleWorkbenchTool(tool: ToolId) {
    const wasActive = options.activeTool.value === tool;
    options.toggleTool(tool);
    if (wasActive) {
      releaseToolRegions(tool);
      return;
    }
    syncTool(tool);
  }

  function closeWorkbenchTool() {
    const tool = options.activeTool.value;
    if (tool) releaseToolRegions(tool);
    options.closeTool();
  }

  function setContentTab(tab: ContentTab) {
    contentTab.value = tab;
    if (tab === 'data') activeSection.value = 'data';
    if (tab === 'layers') activeSection.value = 'content';
  }

  function toggleContentPanel() {
    contentPanelOpen.value = !contentPanelOpen.value;
  }

  function openBottomDrawer(tab: BottomDrawerTab) {
    bottomDrawerTab.value = tab;
  }

  function closeBottomDrawer() {
    bottomDrawerTab.value = undefined;
  }

  function closeInspector() {
    if (toolInspectorTool.value) {
      toolInspectorTool.value = undefined;
      const active = options.activeTool.value;
      if (active && getToolHost(active) === 'inspector') options.closeTool();
      return;
    }
    options.selection.clear();
  }

  watch(options.activeTool, (tool) => {
    if (!tool) return;
    const override = pinnedSection?.tool === tool ? pinnedSection.section : undefined;
    pinnedSection = undefined;
    syncTool(tool, override);
  });

  return {
    activeSection,
    contentTab,
    contentPanelOpen,
    inspectorTarget,
    bottomDrawerTab,
    openSection,
    openWorkbenchTool,
    toggleWorkbenchTool,
    closeWorkbenchTool,
    setContentTab,
    toggleContentPanel,
    openBottomDrawer,
    closeBottomDrawer,
    closeInspector,
  };
}
