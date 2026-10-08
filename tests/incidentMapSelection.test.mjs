import assert from 'node:assert/strict';
import test from 'node:test';
import { selectionInputForMapFeature } from '../src/incidents/presentation/incidentSelection.ts';
import { INCIDENT_SYSTEM_LAYER_ID } from '../src/incidents/presentation/incidentMapLayer.ts';

test('bridges an incident system feature to unified incident selection', () => {
  const feature = {
    featureId: 'incident-42',
    layerId: INCIDENT_SYSTEM_LAYER_ID,
    layerName: '事件',
    geometryType: 'Point',
    properties: { incidentId: 'incident-42', title: '道路积水' },
  };

  assert.deepEqual(selectionInputForMapFeature(feature), {
    kind: 'incident',
    incidentId: 'incident-42',
  });
});

test('keeps ordinary map features on the existing feature-selection path', () => {
  const feature = {
    featureId: 'parcel-7',
    layerId: 'parcels',
    layerName: '地块',
    geometryType: 'Polygon',
    properties: { owner: '示例' },
  };

  assert.deepEqual(selectionInputForMapFeature(feature), { kind: 'feature', feature });
  assert.deepEqual(selectionInputForMapFeature({ ...feature, layerId: INCIDENT_SYSTEM_LAYER_ID, properties: {} }), {
    kind: 'feature',
    feature: { ...feature, layerId: INCIDENT_SYSTEM_LAYER_ID, properties: {} },
  });
  assert.equal(selectionInputForMapFeature(undefined), undefined);
});