import assert from 'node:assert/strict';
import test from 'node:test';
import {
  convertCoordinate,
  isValidCoordinate,
  wgs84ToGcj02,
  gcj02ToWgs84,
  gcj02ToBd09,
  bd09ToGcj02,
} from '../src/map/coordinateTransform.ts';

test('validates coordinates', () => {
  assert.ok(isValidCoordinate([0, 0]));
  assert.equal(isValidCoordinate([181, 0]), false);
  assert.equal(isValidCoordinate([0, 91]), false);
  assert.equal(isValidCoordinate([NaN, 0]), false);
});

test('same-system conversion returns a copy', () => {
  const coordinate = [113.6, 34.7];
  const out = convertCoordinate(coordinate, 'WGS84', 'WGS84');
  assert.deepEqual(out, coordinate);
  assert.notEqual(out, coordinate);
});

test('invalid coordinates throw', () => {
  assert.throws(() => convertCoordinate([999, 0], 'WGS84', 'GCJ02'));
});

test('WGS84/GCJ02 round-trips within tolerance (in China)', () => {
  const coordinate = [116.397, 39.908];
  const gcj = wgs84ToGcj02(coordinate);
  const back = gcj02ToWgs84(gcj);
  assert.ok(Math.abs(back[0] - coordinate[0]) < 1e-6);
  assert.ok(Math.abs(back[1] - coordinate[1]) < 1e-6);
});

test('GCJ02/BD09 round-trips within tolerance', () => {
  const gcj = [116.404, 39.915];
  const bd = gcj02ToBd09(gcj);
  const back = bd09ToGcj02(bd);
  assert.ok(Math.abs(back[0] - gcj[0]) < 1e-6);
  assert.ok(Math.abs(back[1] - gcj[1]) < 1e-6);
});

test('out-of-China coordinates pass through unchanged', () => {
  const coordinate = [-122.42, 37.77];
  assert.deepEqual(wgs84ToGcj02(coordinate), coordinate);
  assert.deepEqual(gcj02ToWgs84(coordinate), coordinate);
});
