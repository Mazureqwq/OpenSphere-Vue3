<script setup lang="ts">
import TrackPlaybackPanel from '@/components/TrackPlaybackPanel.vue';
import { useWorkspaceContext } from '@/tools/workspaceContext';
const ctx = useWorkspaceContext();
</script>
<template>
  <TrackPlaybackPanel
    :tracks="ctx.playbackTracks.value"
    :state="ctx.playbackState.value"
    :follow="ctx.playbackFollow.value"
    @load="ctx.loadTrackPlayback"
    @select-track="ctx.selectPlaybackTrack"
    @play="ctx.playTrackPlayback"
    @pause="ctx.pauseTrackPlayback"
    @seek="ctx.seekTrackPlayback"
    @speed="ctx.setPlaybackSpeed"
    @follow="ctx.setPlaybackFollow"
    @clear="ctx.clearTrackPlayback"
  />
</template>
