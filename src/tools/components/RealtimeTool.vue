<script setup lang="ts">
import RealtimePanel from '@/components/RealtimePanel.vue';
import { useWorkspaceContext } from '@/tools/workspaceContext';
const ctx = useWorkspaceContext();
</script>
<template>
  <RealtimePanel
    :status="ctx.realtimeStatus.value"
    :track-count="ctx.realtimeTrackCount.value"
    :last-updated="ctx.realtimeLastUpdated.value"
    :error="ctx.realtimeError.value"
    @connect="ctx.connectRealtime"
    @disconnect="ctx.disconnectRealtime"
    @start-simulation="ctx.startRealtimeSimulation"
    @stop-simulation="ctx.stopRealtimeSimulation"
  />
</template>
