import assert from 'node:assert/strict';
import test from 'node:test';
import {
  cancelIncidentGeometryCapture,
  canFinishIncidentGeometryCapture,
  completeIncidentGeometryCapture,
  setIncidentGeometryCaptureMode,
  setIncidentGeometryCaptureVertexCount,
  startIncidentGeometryCapture,
} from '../src/incidents/presentation/incidentGeometryCaptureTask.ts';
import { useIncidentCreateDraft } from '../src/incidents/presentation/useIncidentCreateDraft.ts';

const originalPoint = { type: 'Point', coordinates: [114.173, 22.32] };

test('starts a new event capture in point placement mode', () => {
  assert.deepEqual(startIncidentGeometryCapture(), {
    phase: 'locating',
    mode: 'Point',
    vertexCount: 0,
  });
});

test('switching to a range resets temporary vertices and requires three vertices to finish', () => {
  const started = startIncidentGeometryCapture(originalPoint);
  const outlining = setIncidentGeometryCaptureMode(started, 'Polygon');
  const twoVertices = setIncidentGeometryCaptureVertexCount(outlining, 2);
  const threeVertices = setIncidentGeometryCaptureVertexCount(twoVertices, 3);

  assert.equal(outlining.phase, 'outlining');
  assert.equal(outlining.vertexCount, 0);
  assert.equal(canFinishIncidentGeometryCapture(twoVertices), false);
  assert.equal(canFinishIncidentGeometryCapture(threeVertices), true);
});

test('cancelling a replacement retains the original geometry while completion clears capture state', () => {
  const started = startIncidentGeometryCapture(originalPoint);
  const cancelled = cancelIncidentGeometryCapture(setIncidentGeometryCaptureMode(started, 'Polygon'));

  assert.deepEqual(cancelled, {
    phase: 'idle',
    vertexCount: 0,
    originalGeometry: originalPoint,
  });
  assert.deepEqual(completeIncidentGeometryCapture(started), { phase: 'idle', vertexCount: 0 });
});

test('the create-draft session survives close/reopen and only resets after a successful create', () => {
  const first = useIncidentCreateDraft();
  first.resetAfterCreated();
  first.draft.title = '道路积水';
  first.draft.description = '积水影响南向车道';
  first.draft.geometry = originalPoint;

  const reopened = useIncidentCreateDraft();
  assert.equal(reopened.draft, first.draft);
  assert.equal(reopened.draft.title, '道路积水');
  assert.equal(reopened.draft.description, '积水影响南向车道');
  assert.deepEqual(reopened.draft.geometry, originalPoint);

  reopened.clearGeometry();
  assert.equal(first.draft.geometry, undefined);
  reopened.resetAfterCreated();
  assert.deepEqual({ ...first.draft }, {
    title: '',
    categoryId: 'other',
    severity: 'medium',
    description: '',
    assignedTo: '',
    geometry: undefined,
  });
});
