import assert from 'node:assert/strict';
import test from 'node:test';
import { previewIncidentImport, parseIncidentImport } from '../src/incidents/application/incidentImport.ts';

test('infers CSV field mappings and retains invalid rows for a visible error summary', () => {
  const source = {
    fileName: 'incidents.csv',
    text: '事件名称,longitude,latitude,严重等级\n积水点,139.767,35.681,high\n缺失位置,,,low',
  };
  const preview = previewIncidentImport(source);
  const parsed = parseIncidentImport(source, preview.suggestedMapping);

  assert.equal(preview.format, 'csv');
  assert.equal(preview.suggestedMapping.title, '事件名称');
  assert.equal(preview.suggestedMapping.longitude, 'longitude');
  assert.equal(parsed.rows.length, 2);
  assert.deepEqual(parsed.rows[0].draft.geometry, { type: 'Point', coordinates: [139.767, 35.681] });
  assert.equal(parsed.rows[1].draft.geometry, undefined);
});

test('parses GeoJSON features into incident candidates without turning them into GIS layers', () => {
  const source = {
    fileName: 'incidents.geojson',
    text: JSON.stringify({
      type: 'FeatureCollection',
      features: [
        {
          type: 'Feature',
          properties: { title: '围栏影响范围', categoryId: 'safety', severity: 'critical' },
          geometry: { type: 'Polygon', coordinates: [[[139.7, 35.6], [139.8, 35.6], [139.8, 35.7], [139.7, 35.6]]] },
        },
      ],
    }),
  };

  const parsed = parseIncidentImport(source);
  assert.equal(parsed.format, 'geojson');
  assert.equal(parsed.rows.length, 1);
  assert.equal(parsed.rows[0].draft.title, '围栏影响范围');
  assert.equal(parsed.rows[0].draft.geometry.type, 'Polygon');
});