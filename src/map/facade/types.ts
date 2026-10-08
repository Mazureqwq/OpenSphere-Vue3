import type { IncidentCaptureMode } from '@/incidents/presentation/incidentGeometryCaptureTask';
import type { DrawMode } from '@/map/drawing';
import type { PlaybackPosition, PlaybackTrack } from '@/map/trackPlayback';
import type { BaseMapOption, LayerRecord, PointVisualizationConfig } from '@/types/gis';
import type { MapViewState } from '@/types/workspace';

export interface IncidentGeometryCaptureProgress {
  mode: IncidentCaptureMode;
  vertexCount: number;
  canUndo: boolean;
  canFinish: boolean;
}

export interface IncidentGeometryCaptureRequest {
  mode: IncidentCaptureMode;
  referenceGeometry?: GeoJSON.Geometry;
  onProgress: (progress: IncidentGeometryCaptureProgress) => void;
  onComplete: (geometry: GeoJSON.Geometry) => void;
  onCancel: () => void;
}

export interface MapFacade {
  addLayer(layer: LayerRecord, zoomToLayer?: boolean): void;
  removeLayer(id: string): void;
  clearLayers(): void;
  startIncidentGeometryCapture(request: IncidentGeometryCaptureRequest): void;
  setIncidentGeometryCaptureMode(mode: IncidentCaptureMode): void;
  undoIncidentGeometryCapture(): void;
  finishIncidentGeometryCapture(): void;
  cancelIncidentGeometryCapture(): void;
  setBaseMap(baseMap: BaseMapOption): void;
  getViewState(): MapViewState | undefined;
  setViewState(state: MapViewState): void;
  setDrawMode(mode?: DrawMode, layer?: LayerRecord): boolean | void;
  finishDrawing(): void;
  abortDrawing(): void;
  clearDrawingFeatures(layer: LayerRecord): void;
  deleteSelectedDrawingFeatures(layer?: LayerRecord): number;
  startSpatialQuery(onExtent: (extent: [number, number, number, number]) => void): void;
  focusFeature(layer: LayerRecord, featureId: string): void;
  zoomToLayer(id: string): void;
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
  onUserInteract(callback: () => void): () => void;
  locateCoordinate(coordinate: [number, number]): void;
  focusCoordinate(coordinate: [number, number]): void;
  clearCoordinateLocation(): void;
}
