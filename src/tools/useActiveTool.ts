import { computed, ref } from 'vue';
import type { ToolId } from '@/tools/types';
import { getToolDefinition, toolTitles } from '@/tools/toolRegistry';

const activeTool = ref<ToolId | undefined>('layers');

export function useActiveTool() {
  const currentTool = computed(() => (activeTool.value ? getToolDefinition(activeTool.value) : undefined));
  const currentTitle = computed(() => (activeTool.value ? toolTitles[activeTool.value] : ''));

  function openTool(tool: ToolId) {
    activeTool.value = tool;
  }

  function toggleTool(tool: ToolId) {
    activeTool.value = activeTool.value === tool ? undefined : tool;
  }

  function closeTool() {
    activeTool.value = undefined;
  }

  return {
    activeTool,
    currentTool,
    currentTitle,
    openTool,
    toggleTool,
    closeTool,
  };
}
