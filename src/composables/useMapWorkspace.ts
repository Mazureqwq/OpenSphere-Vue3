import { ref, type Ref } from 'vue';
import type { MapFacade } from '@/map/facade';
import { useActiveTool } from '@/tools/useActiveTool';
import type { WorkspaceContext } from '@/tools/workspaceContext';
import type { ToolId } from '@/tools/types';
import { useLayerWorkspace } from '@/composables/workspace/useLayerWorkspace';
import { useDrawingWorkspace } from '@/composables/workspace/useDrawingWorkspace';
import { useQueryWorkspace } from '@/composables/workspace/useQueryWorkspace';
import { useTrackingWorkspace } from '@/composables/workspace/useTrackingWorkspace';
import { useViewWorkspace } from '@/composables/workspace/useViewWorkspace';

export function useMapWorkspace(mapFacade: Ref<MapFacade | undefined>) {
  const showWmsDialog = ref(false);
  const { activeTool, openTool, toggleTool: rawToggleTool, closeTool } = useActiveTool();

  // late-bound stoppers to avoid init order issues
  const stoppers = {
    stopDrawing: () => undefined as void,
    stopRealtime: () => undefined as void,
    clearPlayback: () => undefined as void,
    stopAllTracking: () => undefined as void,
  };

  const view = useViewWorkspace({
    mapFacade,
    onBeforeRestore: () => stoppers.stopAllTracking(),
    onBeforeClear: () => stoppers.stopAllTracking(),
  });

  const layers = useLayerWorkspace({
    mapFacade,
    onBeforeRemove: (layer) => {
      if (layer.drawing) stoppers.stopDrawing();
      if (layer.realtime) stoppers.stopRealtime();
      if (layer.id === tracking.playback.sourceLayerId.value) stoppers.clearPlayback();
    },
    onEdit: (layer) => {
      drawing.start(layer.id, true);
      openTool('drawing');
    },
  });

  const tracking = useTrackingWorkspace({
    mapFacade,
    addLayer: layers.addLayer,
  });

  const drawing = useDrawingWorkspace({
    mapFacade,
    measurement: view.measurement,
    addLayer: layers.addLayer,
    scheduleWorkspaceSave: view.persistence.scheduleWorkspaceSave,
  });

  const query = useQueryWorkspace({ mapFacade });

  stoppers.stopDrawing = () => drawing.stopDrawing();
  stoppers.stopRealtime = () => tracking.realtime.stop();
  stoppers.clearPlayback = () => tracking.playback.clear();
  stoppers.stopAllTracking = () => tracking.stopAllTracking();

  function toggleTool(tool: ToolId) {
    if (activeTool.value === 'drawing' && tool !== 'drawing') drawing.stopDrawing();
    const openingDrawing = tool === 'drawing' && activeTool.value !== 'drawing';
    rawToggleTool(tool);
    if (openingDrawing) drawing.openExistingDrawingSession();
  }

  function closeActiveTool() {
    if (activeTool.value === 'drawing') drawing.stopDrawing();
    closeTool();
  }

  const context: WorkspaceContext = {
    currentView: view.currentView,
    measurement: view.measurement,
    pointerCoordinate: view.pointerCoordinate,
    showWmsDialog,
    activeTool,
    openTool,
    toggleTool,
    closeActiveTool,
    handleFiles: layers.handleFiles,
    addWmsLayer: layers.addWmsLayer,
    handleRemoveLayer: layers.handleRemoveLayer,
    editLayer: layers.editLayer,
    exportLayer: layers.exportLayer,
    handleBaseMapChange: view.handleBaseMapChange,
    createDrawingLayer: drawing.createDrawingLayer,
    locateCoordinate: view.locateCoordinate,
    requestSpatialQuery: query.requestSpatialQuery,
    focusQueryResult: query.focusQueryResult,
    drawingSessionLayerId: drawing.drawingSessionLayerId,
    drawingEditing: drawing.drawingEditing,
    setDrawMode: drawing.setDrawMode,
    cancelCurrentDrawing: drawing.cancelCurrentDrawing,
    realtimeStatus: tracking.realtime.status,
    realtimeTrackCount: tracking.realtime.trackCount,
    realtimeLastUpdated: tracking.realtime.lastUpdated,
    realtimeError: tracking.realtime.error,
    connectRealtime: tracking.realtime.connect,
    disconnectRealtime: tracking.realtime.disconnect,
    startRealtimeSimulation: tracking.realtime.startSimulation,
    stopRealtimeSimulation: tracking.realtime.stopSimulation,
    playbackTracks: tracking.playback.tracks,
    playbackState: tracking.playback.state,
    playbackFollow: tracking.playback.follow,
    loadTrackPlayback: tracking.playback.load,
    selectPlaybackTrack: tracking.playback.selectTrack,
    playTrackPlayback: tracking.playback.play,
    pauseTrackPlayback: tracking.playback.pause,
    seekTrackPlayback: tracking.playback.seek,
    setPlaybackSpeed: tracking.playback.setSpeed,
    setPlaybackFollow: tracking.playback.setFollow,
    clearTrackPlayback: tracking.playback.clear,
    applyPointVisualization: tracking.visualization.apply,
    clearPointVisualization: tracking.visualization.clear,
    searchResults: view.search.results,
    searchLoading: view.search.loading,
    searchProviderNames: view.search.service.getProviderNames(),
    search: view.search.search,
    selectSearchResult: view.search.select,
    clearSearch: view.search.clear,
    saveWorkspaceNow: view.persistence.saveWorkspaceNow,
    restoreWorkspaceState: view.persistence.restoreWorkspaceState,
    clearWorkspaceState: view.persistence.clearWorkspaceState,
  };

  return {
    context,
    handleViewChange: view.handleViewChange,
    handlePointerChange: view.handlePointerChange,
    handleMeasurementChange: view.handleMeasurementChange,
    handleDrawingChange: drawing.handleDrawingChange,
  };
}
