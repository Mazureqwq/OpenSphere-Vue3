import type { DrawMode } from '@/map/drawing';
import type { PlaybackPosition, PlaybackTrack } from '@/map/trackPlayback';
import type { BaseMapOption, LayerRecord, PointVisualizationConfig } from '@/types/gis';
import type { MapViewState } from '@/types/workspace';

export interface MapFacade {
  addLayer(layer: LayerRecord, zoomToLayer?: boolean): void;
  removeLayer(id: string): void;
  clearLayers(): void;
  setBaseMap(baseMap: BaseMapOption): void;
  getViewState(): MapViewState | undefined;
  setViewState(state: MapViewState): void;
  setDrawMode(mode?: DrawMode, layer?: LayerRecord): boolean | void;
  deleteSelectedDrawingFeatures(layer?: LayerRecord): number;
  startSpatialQuery(onExtent: (extent: [number, number, number, number]) => void): void;
  focusFeature(layer: LayerRecord, featureId: string): void;
  setPointVisualization(layer: LayerRecord, config: PointVisualizationConfig): boolean;
  clearPointVisualization(): void;
  syncRealtimeLayer(layer?: LayerRecord): void;
  setTrackPlayback(
    sourceLayerId: string,
    track: PlaybackTrack,
    position: PlaybackPosition,
    follow: boolean,
  ): void;
  clearTrackPlayback(): void;
  locateCoordinate(coordinate: [number, number]): void;
  focusCoordinate(coordinate: [number, number]): void;
  clearCoordinateLocation(): void;
}
