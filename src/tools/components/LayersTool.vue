<script setup lang="ts">
import LayerWorkspacePanel from '@/components/LayerWorkspacePanel.vue';
import { useWorkspaceContext } from '@/tools/workspaceContext';
const ctx = useWorkspaceContext();
</script>
<template>
  <LayerWorkspacePanel
    :view="ctx.currentView.value"
    @create="ctx.createDrawingLayer"
    @remove="ctx.handleRemoveLayer"
    @edit="ctx.editLayer"
    @export="ctx.exportLayer"
    @locate="ctx.locateCoordinate"
    @base-map="ctx.handleBaseMapChange"
    @request-spatial="ctx.requestSpatialQuery"
    @open-query="ctx.openTool('query')"
  />
</template>
