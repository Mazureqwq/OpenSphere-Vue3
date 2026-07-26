import * as Cesium from 'cesium';

export interface CesiumSpatialQueryHost {
  viewer: Cesium.Viewer;
  interactionHandler: Cesium.ScreenSpaceEventHandler;
  spatialQueryStart?: Cesium.Cartesian2;
  spatialQueryEnd?: Cesium.Cartesian2;
  spatialQueryPreview?: Cesium.Entity;
  spatialQueryCallback?: (extent: [number, number, number, number]) => void;
  restorePickInteraction(): void;
  pickDrawingPosition(screenPosition: Cesium.Cartesian2): Cesium.Cartesian3 | undefined;
  toMapCoordinate(position: Cesium.Cartesian3): [number, number];
}

export function startSpatialQuery(
  host: CesiumSpatialQueryHost,
  onExtent: (extent: [number, number, number, number]) => void,
  bindHandlers: () => void,
) {
  clearSpatialQuery(host);
  host.spatialQueryCallback = onExtent;
  host.viewer.scene.screenSpaceCameraController.enableInputs = false;
  bindHandlers();
}

export function stopSpatialQuery(host: CesiumSpatialQueryHost) {
  clearSpatialQuery(host);
}

export function clearSpatialQuery(host: CesiumSpatialQueryHost) {
  host.interactionHandler.removeInputAction(Cesium.ScreenSpaceEventType.LEFT_DOWN, Cesium.KeyboardEventModifier.SHIFT);
  host.interactionHandler.removeInputAction(Cesium.ScreenSpaceEventType.MOUSE_MOVE, Cesium.KeyboardEventModifier.SHIFT);
  host.interactionHandler.removeInputAction(Cesium.ScreenSpaceEventType.LEFT_UP, Cesium.KeyboardEventModifier.SHIFT);
  if (host.spatialQueryPreview) host.viewer.entities.remove(host.spatialQueryPreview);
  host.spatialQueryPreview = undefined;
  host.spatialQueryStart = undefined;
  host.spatialQueryEnd = undefined;
  host.spatialQueryCallback = undefined;
  host.viewer.scene.screenSpaceCameraController.enableInputs = true;
  host.restorePickInteraction();
}

export function beginSpatialQuery(host: CesiumSpatialQueryHost, position: Cesium.Cartesian2) {
  host.spatialQueryStart = Cesium.Cartesian2.clone(position);
  host.spatialQueryEnd = Cesium.Cartesian2.clone(position);
  ensureSpatialQueryPreview(host);
}

export function updateSpatialQuery(host: CesiumSpatialQueryHost, position: Cesium.Cartesian2) {
  if (!host.spatialQueryStart) return;
  host.spatialQueryEnd = Cesium.Cartesian2.clone(position);
  ensureSpatialQueryPreview(host);
}

export function completeSpatialQuery(host: CesiumSpatialQueryHost, position: Cesium.Cartesian2) {
  if (!host.spatialQueryStart || !host.spatialQueryCallback) {
    clearSpatialQuery(host);
    return;
  }
  host.spatialQueryEnd = Cesium.Cartesian2.clone(position);
  const coordinates = getSpatialQueryPositions(host).map((item) => host.toMapCoordinate(item));
  if (coordinates.length === 4) {
    const longitudes = coordinates.map((coordinate) => coordinate[0]);
    const latitudes = coordinates.map((coordinate) => coordinate[1]);
    host.spatialQueryCallback([
      Math.min(...longitudes),
      Math.min(...latitudes),
      Math.max(...longitudes),
      Math.max(...latitudes),
    ]);
  }
  clearSpatialQuery(host);
}

export function ensureSpatialQueryPreview(host: CesiumSpatialQueryHost) {
  if (host.spatialQueryPreview) return;
  host.spatialQueryPreview = host.viewer.entities.add({
    polyline: {
      positions: new Cesium.CallbackProperty(() => {
        const positions = getSpatialQueryPositions(host);
        return positions.length === 4 ? [...positions, positions[0]] : positions;
      }, false),
      width: 2,
      material: Cesium.Color.fromCssColorString('#38bdf8'),
    },
  });
}

export function getSpatialQueryPositions(host: CesiumSpatialQueryHost) {
  if (!host.spatialQueryStart || !host.spatialQueryEnd) return [];
  const { x: startX, y: startY } = host.spatialQueryStart;
  const { x: endX, y: endY } = host.spatialQueryEnd;
  return [
    new Cesium.Cartesian2(startX, startY),
    new Cesium.Cartesian2(endX, startY),
    new Cesium.Cartesian2(endX, endY),
    new Cesium.Cartesian2(startX, endY),
  ]
    .map((position) => host.pickDrawingPosition(position))
    .filter((position): position is Cesium.Cartesian3 => Boolean(position));
}
