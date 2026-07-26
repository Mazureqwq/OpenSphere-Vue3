import * as Cesium from 'cesium';
import { fromLonLat } from 'ol/proj';
import OlFeature from 'ol/Feature';
import type Feature from 'ol/Feature';
import type Geometry from 'ol/geom/Geometry';
import OlPoint from 'ol/geom/Point';
import OlLineString from 'ol/geom/LineString';
import OlPolygon from 'ol/geom/Polygon';
import type { LayerRecord, SelectedFeatureInfo } from '@/types/gis';
import type { DrawMode } from '@/map/drawing';

export type CesiumDrawMode = Exclude<DrawMode, 'modify'>;

interface DrawingSource {
  addFeature: (feature: Feature<Geometry>) => void;
  removeFeature: (feature: Feature<Geometry>) => void;
}

export interface CesiumDrawingHost {
  viewer: Cesium.Viewer;
  interactionHandler: Cesium.ScreenSpaceEventHandler;
  selectedDrawingFeature?: Feature<Geometry>;
  drawingMode?: CesiumDrawMode;
  drawingLayer?: LayerRecord;
  drawingPositions: Cesium.Cartesian3[];
  drawingCursor?: Cesium.Cartesian3;
  drawingPreviewEntities: Cesium.Entity[];
  onFeatureSelected: (feature?: SelectedFeatureInfo, screenPosition?: number[]) => void;
  onMeasurementChange: (value?: string) => void;
  onDrawingChange: () => void;
  clearSpatialQuery(): void;
  restorePickInteraction(): void;
}

export function setDrawMode(host: CesiumDrawingHost, mode?: DrawMode, layer?: LayerRecord) {
  host.clearSpatialQuery();
  clearDrawingInteraction(host);
  if (!mode || !layer?.drawing || mode === 'modify') return mode !== 'modify';
  host.drawingMode = mode;
  host.drawingLayer = layer;
  host.viewer.scene.screenSpaceCameraController.enableInputs = false;
  host.interactionHandler.setInputAction(
    (event: { position: Cesium.Cartesian2 }) => addDrawingPosition(host, event.position),
    Cesium.ScreenSpaceEventType.LEFT_CLICK,
  );
  host.interactionHandler.setInputAction(
    (event: { endPosition: Cesium.Cartesian2 }) => updateDrawingCursor(host, event.endPosition),
    Cesium.ScreenSpaceEventType.MOUSE_MOVE,
  );
  host.interactionHandler.setInputAction(() => finishDrawing(host), Cesium.ScreenSpaceEventType.LEFT_DOUBLE_CLICK);
  host.interactionHandler.setInputAction(() => finishDrawing(host), Cesium.ScreenSpaceEventType.RIGHT_CLICK);
  return true;
}

export function deleteSelectedDrawingFeatures(host: CesiumDrawingHost, layer?: LayerRecord) {
  if (!layer?.drawing || !host.selectedDrawingFeature) return 0;
  const source = getDrawingSource(layer);
  if (!source) return 0;
  source.removeFeature(host.selectedDrawingFeature);
  host.selectedDrawingFeature = undefined;
  host.onFeatureSelected();
  host.onDrawingChange();
  return 1;
}

export function clearDrawingInteraction(host: CesiumDrawingHost, clearMeasurement = true) {
  host.drawingPreviewEntities.forEach((entity) => host.viewer.entities.remove(entity));
  host.drawingPreviewEntities.length = 0;
  host.drawingMode = undefined;
  host.drawingLayer = undefined;
  host.drawingPositions = [];
  host.drawingCursor = undefined;
  host.viewer.scene.screenSpaceCameraController.enableInputs = true;
  if (clearMeasurement) host.onMeasurementChange(undefined);
  host.restorePickInteraction();
}

export function addDrawingPosition(host: CesiumDrawingHost, screenPosition: Cesium.Cartesian2) {
  const position = pickDrawingPosition(host, screenPosition);
  if (!position || !host.drawingMode) return;
  if (host.drawingMode === 'Point') {
    host.drawingPositions = [position];
    finishDrawing(host);
    return;
  }
  host.drawingPositions.push(position);
  ensureDrawingPreview(host);
  updateDrawingMeasurement(host);
}

export function updateDrawingCursor(host: CesiumDrawingHost, screenPosition: Cesium.Cartesian2) {
  if (!host.drawingMode || host.drawingMode === 'Point') return;
  const position = pickDrawingPosition(host, screenPosition);
  if (!position) return;
  host.drawingCursor = position;
  ensureDrawingPreview(host);
  updateDrawingMeasurement(host);
}

export function finishDrawing(host: CesiumDrawingHost) {
  if (!host.drawingMode || !host.drawingLayer) return;
  if (host.drawingMode !== 'Point' && host.drawingPositions.length < 2) return;
  const source = getDrawingSource(host.drawingLayer);
  if (!source) {
    clearDrawingInteraction(host);
    return;
  }
  const coordinates = host.drawingPositions.map((position) => toMapCoordinate(position));
  const geometry =
    host.drawingMode === 'Point'
      ? new OlPoint(coordinates[0])
      : host.drawingMode === 'LineString'
        ? new OlLineString(coordinates)
        : new OlPolygon([[...coordinates, coordinates[0]]]);
  const feature = new OlFeature<Geometry>({ geometry });
  feature.setId(`${host.drawingLayer.id}-${Date.now()}`);
  source.addFeature(feature);
  host.onMeasurementChange(formatDrawingMeasurement(host.drawingMode, host.drawingPositions));
  clearDrawingInteraction(host, false);
  host.onDrawingChange();
}

export function ensureDrawingPreview(host: CesiumDrawingHost) {
  if (!host.drawingMode || host.drawingMode === 'Point' || host.drawingPreviewEntities.length) return;
  const previewPositions = () => getDrawingPreviewPositions(host);
  host.drawingPreviewEntities.push(
    host.viewer.entities.add({
      polyline: {
        positions: new Cesium.CallbackProperty(() => {
          const positions = previewPositions();
          return host.drawingMode === 'Polygon' && positions.length > 2 ? [...positions, positions[0]] : positions;
        }, false),
        width: 3,
        material: Cesium.Color.fromCssColorString('#fbbf24'),
      },
    }),
  );
  if (host.drawingMode === 'Polygon') {
    host.drawingPreviewEntities.push(
      host.viewer.entities.add({
        polygon: {
          hierarchy: new Cesium.CallbackProperty(() => {
            const positions = previewPositions();
            return positions.length >= 3 ? new Cesium.PolygonHierarchy(positions) : undefined;
          }, false),
          material: Cesium.Color.fromCssColorString('#fbbf24').withAlpha(0.22),
        },
      }),
    );
  }
}

export function getDrawingPreviewPositions(host: CesiumDrawingHost) {
  return host.drawingCursor ? [...host.drawingPositions, host.drawingCursor] : host.drawingPositions;
}

export function updateDrawingMeasurement(host: CesiumDrawingHost) {
  if (host.drawingMode) {
    host.onMeasurementChange(formatDrawingMeasurement(host.drawingMode, getDrawingPreviewPositions(host)));
  }
}

export function formatDrawingMeasurement(mode: CesiumDrawMode, positions: Cesium.Cartesian3[]) {
  if (mode === 'Point') return '点位已添加';
  if (mode === 'LineString') {
    const distance = getGeodesicDistance(positions);
    return distance >= 1000
      ? '距离：' + (distance / 1000).toFixed(2) + ' km'
      : '距离：' + distance.toFixed(1) + ' m';
  }
  const area = getGeodesicArea(positions);
  return area >= 1000000
    ? '面积：' + (area / 1000000).toFixed(2) + ' km²'
    : '面积：' + area.toFixed(1) + ' m²';
}

export function getGeodesicDistance(positions: Cesium.Cartesian3[]) {
  return positions.slice(1).reduce((total, position, index) => {
    const start = Cesium.Cartographic.fromCartesian(positions[index]);
    const end = Cesium.Cartographic.fromCartesian(position);
    return total + new Cesium.EllipsoidGeodesic(start, end).surfaceDistance;
  }, 0);
}

export function getGeodesicArea(positions: Cesium.Cartesian3[]) {
  if (positions.length < 3) return 0;
  const cartographics = positions.map((position) => Cesium.Cartographic.fromCartesian(position));
  const radius = Cesium.Ellipsoid.WGS84.maximumRadius;
  const total = cartographics.reduce((sum, current, index) => {
    const next = cartographics[(index + 1) % cartographics.length];
    return sum + (next.longitude - current.longitude) * (2 + Math.sin(current.latitude) + Math.sin(next.latitude));
  }, 0);
  return Math.abs(total) * radius ** 2 / 2;
}

export function pickDrawingPosition(host: CesiumDrawingHost, screenPosition: Cesium.Cartesian2) {
  return host.viewer.camera.pickEllipsoid(screenPosition, host.viewer.scene.globe.ellipsoid) ?? undefined;
}

export function toMapCoordinate(position: Cesium.Cartesian3) {
  const cartographic = Cesium.Cartographic.fromCartesian(position);
  return fromLonLat([
    Cesium.Math.toDegrees(cartographic.longitude),
    Cesium.Math.toDegrees(cartographic.latitude),
  ]);
}

export function getDrawingSource(record: LayerRecord) {
  return (record.source as unknown as { getSource?: () => DrawingSource | null }).getSource?.() ?? undefined;
}
