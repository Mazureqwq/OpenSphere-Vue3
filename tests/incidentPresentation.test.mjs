import assert from 'node:assert/strict';
import test from 'node:test';
import { isWorkspacePersistableLayer } from '../src/types/gis.ts';
import {
  INCIDENT_SYSTEM_LAYER_ID,
  createIncidentSystemLayer,
  replaceIncidentSystemLayer,
  syncIncidentSystemProjection,
} from '../src/incidents/presentation/incidentMapLayer.ts';

function incident(id, severity = 'high') {
  return {
    id,
    schemaVersion: 1,
    projectId: 'local-demo',
    code: `INC-${id}`,
    title: '道路积水',
    categoryId: 'weather',
    severity,
    status: 'unassigned',
    geometry: { type: 'Point', coordinates: [139.767, 35.681] },
    createdBy: 'demo-admin',
    createdAt: '2026-10-07T08:00:00.000Z',
    updatedAt: '2026-10-07T08:00:00.000Z',
    version: 1,
  };
}

test('maps each incident to a stable read-only system feature rather than a business source of truth', () => {
  const record = createIncidentSystemLayer([incident('incident-1')]);
  const feature = record.source.getSource().getFeatures()[0];

  assert.equal(record.id, INCIDENT_SYSTEM_LAYER_ID);
  assert.equal(record.system, 'incidents');
  assert.equal(record.name, '事件');
  assert.equal(record.featureCount, 1);
  assert.equal(feature.getId(), 'incident-1');
  assert.equal(feature.get('incidentId'), 'incident-1');
  assert.equal(feature.get('status'), 'unassigned');
  assert.equal(feature.get('severity'), 'high');
  assert.equal(isWorkspacePersistableLayer(record), false);
});

test('replaces a prior incident projection instead of accumulating duplicate system layers', () => {
  const oldProjection = createIncidentSystemLayer([incident('old-incident')]);
  const nextLayers = replaceIncidentSystemLayer([oldProjection], [incident('new-incident', 'critical')]);
  const projection = nextLayers.find((layer) => layer.id === INCIDENT_SYSTEM_LAYER_ID);

  assert.equal(nextLayers.filter((layer) => layer.system === 'incidents').length, 1);
  assert.equal(projection.source.getSource().getFeatures()[0].getId(), 'new-incident');
});

test('synchronizes exactly one system projection through a host without selecting it as a normal layer', () => {
  const oldProjection = createIncidentSystemLayer([incident('old')]);
  const host = {
    layers: [oldProjection],
    added: [],
    removed: [],
    addSystemLayer(layer) { this.added.push(layer); this.layers.push(layer); },
    removeSystemLayer(id) { this.removed.push(id); this.layers = this.layers.filter((layer) => layer.id !== id); },
  };
  const facade = {
    added: [],
    removed: [],
    addLayer(layer) { this.added.push(layer.id); },
    removeLayer(id) { this.removed.push(id); },
  };

  const synced = syncIncidentSystemProjection(host, [incident('fresh')], facade);

  assert.equal(synced.id, INCIDENT_SYSTEM_LAYER_ID);
  assert.deepEqual(host.removed, [INCIDENT_SYSTEM_LAYER_ID]);
  assert.deepEqual(facade.removed, [INCIDENT_SYSTEM_LAYER_ID]);
  assert.deepEqual(facade.added, [INCIDENT_SYSTEM_LAYER_ID]);
  assert.equal(host.layers.filter((layer) => layer.system === 'incidents').length, 1);
});

test('renders saved incident polygons with their configured translucent fill', () => {
  const rangedIncident = {
    ...incident('range-incident', 'high'),
    geometry: {
      type: 'Polygon',
      coordinates: [[[139.76, 35.68], [139.78, 35.68], [139.78, 35.70], [139.76, 35.68]]],
    },
  };
  const record = createIncidentSystemLayer([rangedIncident]);
  const feature = record.source.getSource().getFeatures()[0];
  const style = record.source.getStyleFunction()(feature, 1);

  assert.equal(style.getFill().getColor(), 'rgba(242, 139, 84, 0.38)');
});
