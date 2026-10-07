<script setup lang="ts">
import LayerWorkspacePanel from '@/components/LayerWorkspacePanel.vue';
import { useWorkspaceContext } from '@/tools/workspaceContext';

withDefaults(defineProps<{ mode?: 'content' | 'data' }>(), { mode: 'content' });
const ctx = useWorkspaceContext();
</script>

<template>
  <LayerWorkspacePanel
    :view="ctx.currentView.value"
    :mode="mode"
    @create="ctx.createDrawingLayer"
    @remove="ctx.handleRemoveLayer"
    @edit="ctx.editLayer"
    @export="ctx.exportLayer"
    @import="ctx.handleFiles"
    @open-wms="ctx.showWmsDialog.value = true"
    @locate="ctx.locateCoordinate"
    @base-map="ctx.handleBaseMapChange"
    @request-spatial="ctx.requestSpatialQuery"
    @open-query="ctx.openTool('query')"
  />
</template>
