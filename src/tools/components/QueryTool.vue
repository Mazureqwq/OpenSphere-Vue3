<script setup lang="ts">
import QueryPanel from '@/components/QueryPanel.vue';
import { useWorkspaceContext } from '@/tools/workspaceContext';
const ctx = useWorkspaceContext();
</script>
<template>
  <QueryPanel @request-spatial="ctx.requestSpatialQuery" @focus="ctx.focusQueryResult" />
</template>
