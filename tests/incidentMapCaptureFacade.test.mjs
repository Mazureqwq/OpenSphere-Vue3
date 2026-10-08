import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const readProjectFile = (relativePath) => readFile(path.join(root, relativePath), 'utf8');

test('map facade exposes a controlled incident geometry-capture contract', async () => {
  const [facade, facadeIndex] = await Promise.all([
    readProjectFile('src/map/facade/types.ts'),
    readProjectFile('src/map/facade/index.ts'),
  ]);

  assert.match(facade, /export interface IncidentGeometryCaptureProgress/);
  assert.match(facadeIndex, /IncidentGeometryCaptureProgress/);
  assert.match(facadeIndex, /IncidentGeometryCaptureRequest/);
  assert.match(facade, /export interface IncidentGeometryCaptureRequest/);
  assert.match(facade, /referenceGeometry\?: GeoJSON\.Geometry/);
  assert.match(facade, /onProgress: \(progress: IncidentGeometryCaptureProgress\) => void/);
  assert.match(facade, /onComplete: \(geometry: GeoJSON\.Geometry\) => void/);
  assert.match(facade, /onCancel: \(\) => void/);
  assert.match(facade, /startIncidentGeometryCapture\(request: IncidentGeometryCaptureRequest\): void/);
  assert.match(facade, /setIncidentGeometryCaptureMode\(mode: IncidentCaptureMode\): void/);
  assert.match(facade, /undoIncidentGeometryCapture\(\): void/);
  assert.match(facade, /finishIncidentGeometryCapture\(\): void/);
  assert.match(facade, /cancelIncidentGeometryCapture\(\): void/);
  assert.doesNotMatch(facade, /captureGeometry\(kind:/);
});

test('OpenLayers event capture owns a temporary reference and explicit undo/finish controls', async () => {
  const manager = await readProjectFile('src/map/MapManager.ts');

  assert.match(manager, /startIncidentGeometryCapture\(request: IncidentGeometryCaptureRequest\)/);
  assert.match(manager, /setIncidentGeometryCaptureMode\(mode: IncidentCaptureMode\)/);
  assert.match(manager, /undoIncidentGeometryCapture\(\)/);
  assert.match(manager, /geometryCaptureDraw\?\.removeLastPoint\(\)/);
  assert.match(manager, /geometryCaptureDraw\?\.finishDrawing\(\)/);
  assert.match(manager, /referenceGeometry/);
  assert.match(manager, /onProgress\(this\.getGeometryCaptureProgress\(\)\)/);
  assert.match(manager, /request\.onCancel\(\)/);
  assert.match(manager, /vertexCount >= 3/);
});

test('OpenLayers task cancellation is isolated from ordinary drawing APIs', async () => {
  const [manager, facade] = await Promise.all([
    readProjectFile('src/map/MapManager.ts'),
    readProjectFile('src/map/facade/types.ts'),
  ]);

  assert.match(manager, /clearDataLayers\(\) \{ this\.cancelIncidentGeometryCapture\(\)/);
  assert.match(manager, /dispose\(\) \{ this\.cancelIncidentGeometryCapture\(\)/);
  assert.match(facade, /finishDrawing\(\): void/);
  assert.match(facade, /abortDrawing\(\): void/);
});


test('Cesium and MapView mirror the controlled capture lifecycle without stale async completion', async () => {
  const [cesium, mapView] = await Promise.all([
    readProjectFile('src/map/CesiumManager.ts'),
    readProjectFile('src/components/MapView.vue'),
  ]);

  assert.match(cesium, /startIncidentGeometryCapture\(request: IncidentGeometryCaptureRequest\)/);
  assert.match(cesium, /setIncidentGeometryCaptureMode\(mode: IncidentCaptureMode\)/);
  assert.match(cesium, /undoIncidentGeometryCapture\(\)/);
  assert.match(cesium, /this\.geometryCapturePositions\.pop\(\)/);
  assert.match(cesium, /finishIncidentGeometryCapture\(\)/);
  assert.match(cesium, /geometryCaptureReferenceEntities/);
  assert.match(cesium, /request\.onProgress\(this\.getGeometryCaptureProgress\(\)\)/);
  assert.match(cesium, /if \(this\.geometryCapturePositions\.length < 3\) return;/);

  assert.match(mapView, /let activeIncidentCapture/);
  assert.match(mapView, /startIncidentGeometryCapture\(request: IncidentGeometryCaptureRequest\)/);
  assert.match(mapView, /cancelIncidentGeometryCapture\(\)/);
  assert.match(mapView, /generation !== geometryCaptureGeneration/);
  assert.match(mapView, /onBeforeUnmount\(\(\) => \{ hasUnmounted = true; cancelIncidentGeometryCapture\(\);/);
  assert.doesNotMatch(mapView, /async function captureGeometry/);
});
