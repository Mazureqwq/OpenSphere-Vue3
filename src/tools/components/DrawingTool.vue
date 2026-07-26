<script setup lang="ts">
import DrawingPanel from '@/components/DrawingPanel.vue';
import { useWorkspaceContext } from '@/tools/workspaceContext';
const ctx = useWorkspaceContext();
</script>
<template>
  <DrawingPanel
    :enabled="Boolean(ctx.drawingSessionLayerId.value)"
    :editing="ctx.drawingEditing.value"
    @create="ctx.createDrawingLayer"
    @mode="ctx.setDrawMode"
    @stop="ctx.cancelCurrentDrawing"
  />
</template>
