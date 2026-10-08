import assert from 'node:assert/strict';
import test from 'node:test';
import { createDemoIncidentSeed } from '../src/incidents/application/demoData.ts';
import { IncidentService } from '../src/incidents/application/incidentService.ts';
import { createMemoryIncidentRepository } from '../src/incidents/repositories/memoryIncidentRepository.ts';

const fixedTime = '2026-10-07T10:00:00.000Z';
const admin = { id: 'demo-admin', name: '管理员', role: 'admin' };
const dispatcher = { id: 'demo-dispatcher', name: '调度员', role: 'dispatcher' };
const supervisor = { id: 'demo-supervisor', name: '主管', role: 'supervisor' };

function createService() {
  let nextId = 0;
  const repository = createMemoryIncidentRepository();
  const service = new IncidentService(repository, {
    now: () => fixedTime,
    idFactory: (prefix) => `${prefix}-${++nextId}`,
  });
  return { repository, service };
}

function incidentDraft() {
  return {
    title: '道路积水',
    categoryId: 'weather',
    severity: 'high',
    geometry: { type: 'Point', coordinates: [139.767, 35.681] },
    description: '调度员录入',
  };
}

test('appends an immutable timeline entry for every permitted workflow command', async () => {
  const { repository, service } = createService();
  await service.initialize(createDemoIncidentSeed());
  const created = await service.create(incidentDraft(), dispatcher);
  const assigned = await service.assign(created.id, dispatcher.id, dispatcher);
  const started = await service.start(assigned.id, dispatcher);
  const updated = await service.update(started.id, '已完成现场排水', dispatcher);
  const submitted = await service.submitForReview(updated.id, '请主管审核', dispatcher);
  const closed = await service.approve(submitted.id, '复核通过', supervisor);

  assert.equal(closed.status, 'closed');
  assert.equal(closed.version, 6);
  assert.deepEqual(
    (await repository.listTimeline(created.id)).map((entry) => entry.action),
    ['created', 'assign', 'start', 'update', 'submit_review', 'approve'],
  );
});

test('rejects an unauthorized review without changing the incident or its timeline', async () => {
  const { repository, service } = createService();
  await service.initialize(createDemoIncidentSeed());
  const created = await service.create(incidentDraft(), dispatcher);
  const assigned = await service.assign(created.id, dispatcher.id, dispatcher);
  const started = await service.start(assigned.id, dispatcher);
  const submitted = await service.submitForReview(started.id, '请审核', dispatcher);
  const before = await repository.getIncident(submitted.id);
  const timelineBefore = await repository.listTimeline(submitted.id);

  await assert.rejects(service.approve(submitted.id, '越权审核', dispatcher), /无权限|permission/i);

  assert.deepEqual(await repository.getIncident(submitted.id), before);
  assert.deepEqual(await repository.listTimeline(submitted.id), timelineBefore);
});

test('revokes an import batch only while every successful event remains unassigned', async () => {
  const { repository, service } = createService();
  await service.initialize(createDemoIncidentSeed());
  const imported = await service.importText({
    fileName: 'incidents.csv',
    text: 'title,longitude,latitude\n积水点 A,139.70,35.60\n积水点 B,139.71,35.61',
  }, dispatcher);

  await service.revokeImportBatch(imported.batch.id, dispatcher);
  assert.equal(await repository.getIncident(imported.incidents[0].id), undefined);
  assert.equal((await repository.getImportBatch(imported.batch.id)).revokedAt, fixedTime);

  const locked = await service.importText({
    fileName: 'locked.csv',
    text: 'title,longitude,latitude\n不可撤销的导入,139.72,35.62',
  }, dispatcher);
  await service.assign(locked.incidents[0].id, dispatcher.id, dispatcher);

  await assert.rejects(service.revokeImportBatch(locked.batch.id, dispatcher), /待分派/);
  assert.ok(await repository.getIncident(locked.incidents[0].id));
  assert.equal((await repository.getImportBatch(locked.batch.id)).revokedAt, undefined);
});