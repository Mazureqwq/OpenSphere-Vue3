import { computed, ref, type Ref } from 'vue';
import { storeToRefs } from 'pinia';
import type { MapFacade } from '@/map/facade';
import { useActiveTool } from '@/tools/useActiveTool';
import type { WorkspaceContext } from '@/tools/workspaceContext';
import type { ToolId } from '@/tools/types';
import { useLayerWorkspace } from '@/composables/workspace/useLayerWorkspace';
import { useDrawingWorkspace } from '@/composables/workspace/useDrawingWorkspace';
import { useQueryWorkspace } from '@/composables/workspace/useQueryWorkspace';
import { useTrackingWorkspace } from '@/composables/workspace/useTrackingWorkspace';
import { useViewWorkspace } from '@/composables/workspace/useViewWorkspace';
import { useWorkbenchLayout } from '@/composables/useWorkbenchLayout';
import { useMapStore } from '@/stores/map';
import { useSelectionStore } from '@/stores/selection';

export function useMapWorkspace(mapFacade: Ref<MapFacade | undefined>) {
  const showWmsDialog = ref(false);
  const mapStore = useMapStore();
  const { activeTool, openTool: rawOpenTool, toggleTool: rawToggleTool, closeTool } = useActiveTool();

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
      rawOpenTool('drawing');
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

  function openTool(tool: ToolId) {
    if (activeTool.value === 'drawing' && tool !== 'drawing') drawing.stopDrawing();
    const openingDrawing = tool === 'drawing' && activeTool.value !== 'drawing';
    rawOpenTool(tool);
    if (openingDrawing && !drawing.drawingSessionLayerId.value) drawing.openExistingDrawingSession();
  }

  function toggleTool(tool: ToolId) {
    if (activeTool.value === 'drawing' && tool !== 'drawing') drawing.stopDrawing();
    const openingDrawing = tool === 'drawing' && activeTool.value !== 'drawing';
    rawToggleTool(tool);
    if (openingDrawing && !drawing.drawingSessionLayerId.value) drawing.openExistingDrawingSession();
  }

  function closeActiveTool() {
    if (activeTool.value === 'drawing') drawing.stopDrawing();
    closeTool();
  }

  function zoomToLayer(layerId: string) {
    if (mapStore.layers.some((item) => item.id === layerId)) mapFacade.value?.zoomToLayer(layerId);
  }

  const selectionStore = useSelectionStore();
  const layout = useWorkbenchLayout({
    activeTool,
    openTool,
    toggleTool,
    closeTool: closeActiveTool,
    selection: { current: storeToRefs(selectionStore).current, clear: () => selectionStore.clear() },
  });

  const context: WorkspaceContext = {
    currentView: view.currentView,
    measurement: view.measurement,
    pointerCoordinate: view.pointerCoordinate,
    showWmsDialog,
    activeTool,
    openTool: layout.openWorkbenchTool,
    toggleTool: layout.toggleWorkbenchTool,
    closeActiveTool: layout.closeWorkbenchTool,
    activeSection: layout.activeSection,
    contentTab: layout.contentTab,
    contentPanelOpen: layout.contentPanelOpen,
    inspectorTarget: layout.inspectorTarget,
    bottomDrawerTab: layout.bottomDrawerTab,
    openSection: layout.openSection,
    setContentTab: layout.setContentTab,
    toggleContentPanel: layout.toggleContentPanel,
    openBottomDrawer: layout.openBottomDrawer,
    closeBottomDrawer: layout.closeBottomDrawer,
    closeInspector: layout.closeInspector,
    handleFiles: layers.handleFiles,
    loadDemoData: layers.loadDemoData,
    addWmsLayer: layers.addWmsLayer,
    handleRemoveLayer: layers.handleRemoveLayer,
    editLayer: layers.editLayer,
    exportLayer: layers.exportLayer,
    handleBaseMapChange: view.handleBaseMapChange,
    createDrawingLayer: drawing.createDrawingLayer,
    locateCoordinate: view.locateCoordinate,
    requestSpatialQuery: query.requestSpatialQuery,
    focusQueryResult: query.focusQueryResult,
    zoomToLayer,
    drawingSessionLayerId: drawing.drawingSessionLayerId,
    drawingEditing: drawing.drawingEditing,
    activeDrawingMode: drawing.activeDrawingMode,
    setDrawMode: drawing.setDrawMode,
    finishCurrentDrawing: drawing.finishCurrentDrawing,
    cancelCurrentDrawing: drawing.cancelCurrentDrawing,
    deleteSelectedDrawingFeatures: drawing.deleteSelectedDrawingFeatures,
    clearDrawingFeatures: drawing.clearDrawingFeatures,
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
