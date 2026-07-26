import { inject, type InjectionKey, type Ref } from 'vue';
import type { RealtimeStatus } from '@/map/realtime';
import type { DrawMode } from '@/map/drawing';
import type { PlaybackTrack, TrackPlaybackState } from '@/map/trackPlayback';
import type { PointVisualizationConfig } from '@/types/gis';
import type { MapViewState } from '@/types/workspace';
import type { SearchResult } from '@/search/types';
import type { ToolId } from '@/tools/types';
import type { WmsLayerInput } from '@/map/ogc';

export interface WorkspaceContext {
  currentView: Ref<MapViewState>;
  measurement: Ref<string | undefined>;
  pointerCoordinate: Ref<[number, number] | undefined>;
  showWmsDialog: Ref<boolean>;

  activeTool: Ref<ToolId | undefined>;
  openTool: (tool: ToolId) => void;
  toggleTool: (tool: ToolId) => void;
  closeActiveTool: () => void;

  handleFiles: (files: FileList | null) => void | Promise<void>;
  addWmsLayer: (input: WmsLayerInput) => void;
  handleRemoveLayer: (id: string) => void;
  editLayer: (id: string) => void;
  exportLayer: (id: string) => void;
  handleBaseMapChange: () => void;
  createDrawingLayer: (name?: string, layerType?: 'drawing' | 'vector') => void;
  locateCoordinate: (coordinate: [number, number]) => void;
  requestSpatialQuery: () => void;
  focusQueryResult: (layerId: string, featureId: string) => void;

  drawingSessionLayerId: Ref<string | undefined>;
  drawingEditing: Ref<boolean>;
  setDrawMode: (mode: DrawMode) => void;
  cancelCurrentDrawing: () => void;

  realtimeStatus: Ref<RealtimeStatus>;
  realtimeTrackCount: Ref<number>;
  realtimeLastUpdated: Ref<string | undefined>;
  realtimeError: Ref<string | undefined>;
  connectRealtime: (url: string) => void;
  disconnectRealtime: () => void;
  startRealtimeSimulation: () => void;
  stopRealtimeSimulation: () => void;

  playbackTracks: Ref<PlaybackTrack[]>;
  playbackState: Ref<TrackPlaybackState>;
  playbackFollow: Ref<boolean>;
  loadTrackPlayback: (layerId: string, idField: string, timeField: string) => void;
  selectPlaybackTrack: (id: string) => void;
  playTrackPlayback: () => void;
  pauseTrackPlayback: () => void;
  seekTrackPlayback: (timestamp: number) => void;
  setPlaybackSpeed: (speed: number) => void;
  setPlaybackFollow: (value: boolean) => void;
  clearTrackPlayback: () => void;

  applyPointVisualization: (layerId: string, config: PointVisualizationConfig) => void;
  clearPointVisualization: () => void;

  searchResults: Ref<SearchResult[]>;
  searchLoading: Ref<boolean>;
  searchProviderNames: string[];
  search: (keyword: string, providerNames?: string[]) => void | Promise<void>;
  selectSearchResult: (result: SearchResult) => void;
  clearSearch: () => void;

  saveWorkspaceNow: () => void;
  restoreWorkspaceState: (notify?: boolean) => void;
  clearWorkspaceState: () => void | Promise<void>;
}

export const workspaceContextKey: InjectionKey<WorkspaceContext> = Symbol('workspaceContext');

export function useWorkspaceContext(): WorkspaceContext {
  const ctx = inject(workspaceContextKey);
  if (!ctx) throw new Error('WorkspaceContext 未提供');
  return ctx;
}
