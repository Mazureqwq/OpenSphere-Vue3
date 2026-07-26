<script setup lang="ts">
import PointVisualizationPanel from '@/components/PointVisualizationPanel.vue';
import { useWorkspaceContext } from '@/tools/workspaceContext';
const ctx = useWorkspaceContext();
</script>
<template>
  <PointVisualizationPanel @apply="ctx.applyPointVisualization" @clear="ctx.clearPointVisualization" />
</template>
