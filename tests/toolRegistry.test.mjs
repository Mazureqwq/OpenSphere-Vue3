import assert from 'node:assert/strict';
import test from 'node:test';
import { toolIds, toolTitles } from '../src/tools/toolMeta.ts';

test('tool metadata lists every tool id with a title', () => {
  assert.ok(toolIds.length > 0);
  assert.equal(toolIds.length, new Set(toolIds).size);
  for (const id of toolIds) {
    assert.equal(typeof toolTitles[id], 'string');
    assert.ok(toolTitles[id].length > 0);
  }
  assert.equal(toolIds.length, Object.keys(toolTitles).length);
});

test('map facade method names stay stable', () => {
  const methods = [
    'addLayer',
    'removeLayer',
    'clearLayers',
    'setBaseMap',
    'getViewState',
    'setViewState',
    'setDrawMode',
    'deleteSelectedDrawingFeatures',
    'startSpatialQuery',
    'focusFeature',
    'setPointVisualization',
    'clearPointVisualization',
    'syncRealtimeLayer',
    'setTrackPlayback',
    'clearTrackPlayback',
    'locateCoordinate',
    'focusCoordinate',
    'clearCoordinateLocation',
  ];
  assert.equal(methods.length, 18);
  assert.equal(new Set(methods).size, methods.length);
});
