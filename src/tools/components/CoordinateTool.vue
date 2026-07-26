<script setup lang="ts">
import CoordinatePanel from '@/components/CoordinatePanel.vue';
import { useWorkspaceContext } from '@/tools/workspaceContext';
const ctx = useWorkspaceContext();
</script>
<template>
  <CoordinatePanel @locate="ctx.locateCoordinate" />
</template>
