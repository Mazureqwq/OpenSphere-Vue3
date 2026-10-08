import assert from 'node:assert/strict';
import test from 'node:test';
import { DEFAULT_LOCAL_PROJECT_ID } from '../src/incidents/domain/types.ts';
import { transitionIncident } from '../src/incidents/domain/incidentMachine.ts';
import { canIncidentAction } from '../src/incidents/domain/permissions.ts';
import { validateIncidentDraft } from '../src/incidents/domain/importValidation.ts';
import { incidentApiEventNames } from '../src/incidents/contracts/api.ts';

const admin = { id: 'demo-admin', name: '管理员', role: 'admin' };
const dispatcher = { id: 'demo-dispatcher', name: '调度员', role: 'dispatcher' };
const supervisor = { id: 'demo-supervisor', name: '主管', role: 'supervisor' };
const fixedTime = '2026-10-07T08:00:00.000Z';

function createIncident(status = 'unassigned') {
  return {
    id: 'incident-001',
    schemaVersion: 1,
    projectId: DEFAULT_LOCAL_PROJECT_ID,
    code: 'INC-001',
    title: '道路积水',
    categoryId: 'weather',
    severity: 'high',
    status,
    geometry: { type: 'Point', coordinates: [139.767, 35.681] },
    createdBy: admin.id,
    createdAt: fixedTime,
    updatedAt: fixedTime,
    version: 1,
  };
}

test('permits only the approved incident workflow and records transition metadata', () => {
  const assigned = transitionIncident(createIncident(), 'assign', dispatcher, {
    assignedTo: dispatcher.id,
    at: '2026-10-07T08:01:00.000Z',
  });
  assert.equal(assigned.incident.status, 'assigned');
  assert.equal(assigned.incident.assignedTo, dispatcher.id);
  assert.equal(assigned.incident.version, 2);
  assert.equal(assigned.timeline.action, 'assign');

  const inProgress = transitionIncident(assigned.incident, 'start', dispatcher, {
    at: '2026-10-07T08:02:00.000Z',
  });
  const awaitingReview = transitionIncident(inProgress.incident, 'submit_review', dispatcher, {
    note: '已完成现场处置',
    at: '2026-10-07T08:03:00.000Z',
  });
  const closed = transitionIncident(awaitingReview.incident, 'approve', supervisor, {
    note: '复核通过',
    at: '2026-10-07T08:04:00.000Z',
  });

  assert.equal(closed.incident.status, 'closed');
  assert.equal(closed.timeline.action, 'approve');
  assert.throws(() => transitionIncident(closed.incident, 'assign', admin), /不允许|invalid/i);
});

test('centralizes role policy instead of relying on visible UI actions', () => {
  const pendingReview = createIncident('pending_review');
  assert.equal(canIncidentAction('dispatcher', 'approve', pendingReview), false);
  assert.equal(canIncidentAction('supervisor', 'approve', pendingReview), true);
  assert.equal(canIncidentAction('admin', 'manage_categories'), true);
  assert.equal(canIncidentAction('supervisor', 'create'), false);
  assert.throws(() => transitionIncident(pendingReview, 'approve', dispatcher), /无权限|permission/i);
});

test('allows a reasoned cancellation only before a terminal state', () => {
  const cancelled = transitionIncident(createIncident('pending_review'), 'cancel', supervisor, {
    reason: '重复报送',
    at: '2026-10-07T08:05:00.000Z',
  });

  assert.equal(cancelled.incident.status, 'cancelled');
  assert.equal(cancelled.timeline.reason, '重复报送');
  assert.throws(() => transitionIncident(createIncident(), 'cancel', admin), /原因|required/i);
  assert.throws(() => transitionIncident(createIncident('closed'), 'cancel', admin, { reason: 'too late' }), /不允许|invalid/i);
});

test('validates a normalized EPSG:4326 incident draft and defaults optional import values', () => {
  const invalid = validateIncidentDraft({
    title: ' ',
    geometry: { type: 'Point', coordinates: [200, 95] },
  });
  assert.equal(invalid.valid, false);
  assert.ok(invalid.errors.title);
  assert.ok(invalid.errors.geometry);

  const valid = validateIncidentDraft({
    title: '积水点',
    geometry: { type: 'Point', coordinates: [139.767, 35.681] },
  });
  assert.equal(valid.valid, true);
  assert.deepEqual(valid.normalized, {
    title: '积水点',
    categoryId: 'other',
    severity: 'medium',
    geometry: { type: 'Point', coordinates: [139.767, 35.681] },
  });
});

test('exposes stable local project and future event contract names without networking', () => {
  assert.equal(DEFAULT_LOCAL_PROJECT_ID, 'local-demo');
  assert.deepEqual(incidentApiEventNames, [
    'incident.created',
    'incident.updated',
    'incident.assignment.changed',
    'incident.reviewed',
    'import.completed',
  ]);
});