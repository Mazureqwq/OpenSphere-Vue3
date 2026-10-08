import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import { filterAndSortIncidentQueue } from '../src/incidents/presentation/incidentQueue.ts';
import { submitIncidentDraft } from '../src/incidents/presentation/incidentFormModel.ts';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const readProjectFile = (relativePath) => readFile(path.join(root, relativePath), 'utf8');

function incident(id, status, severity, updatedAt) {
  return {
    id,
    schemaVersion: 1,
    projectId: 'local-demo',
    code: `INC-${id}`,
    title: id,
    categoryId: 'other',
    severity,
    status,
    geometry: { type: 'Point', coordinates: [139.7, 35.6] },
    createdBy: 'demo-admin',
    createdAt: updatedAt,
    updatedAt,
    version: 1,
  };
}

test('event tool exposes queue and import batch workspaces without content/data duplicate navigation', async () => {
  const [tool, importDialog, contentPanel] = await Promise.all([
    readProjectFile('src/tools/components/IncidentTool.vue'),
    readProjectFile('src/incidents/components/IncidentImportDialog.vue'),
    readProjectFile('src/layout/ContentPanel.vue'),
  ]);

  assert.match(tool, /事件队列/);
  assert.match(tool, /导入批次/);
  assert.match(importDialog, /accept="\.csv,\.geojson,\.json"/);
  assert.doesNotMatch(contentPanel, /事件.*数据.*tablist/);
});

test('filters the queue by status and severity then orders visible incidents by newest update', () => {
  const incidents = [
    incident('older-high', 'unassigned', 'high', '2026-10-07T08:00:00.000Z'),
    incident('newer-high', 'unassigned', 'high', '2026-10-07T10:00:00.000Z'),
    incident('critical-review', 'pending_review', 'critical', '2026-10-07T11:00:00.000Z'),
  ];

  assert.deepEqual(
    filterAndSortIncidentQueue(incidents, { status: 'unassigned', severity: 'high' }).map((item) => item.id),
    ['newer-high', 'older-high'],
  );
  assert.deepEqual(
    filterAndSortIncidentQueue(incidents, { severity: 'critical' }).map((item) => item.id),
    ['critical-review'],
  );
});

test('does not create an incident when the user cancels a map geometry capture', async () => {
  let createCalls = 0;
  const result = await submitIncidentDraft(
    { title: '未完成拾取', categoryId: 'other', severity: 'medium', geometry: undefined },
    async () => { createCalls += 1; return { id: 'should-not-exist' }; },
  );

  assert.equal(result, undefined);
  assert.equal(createCalls, 0);
});
test('keeps the map interactive while a single-entry event map task is active', async () => {
  const [form, task] = await Promise.all([
    readProjectFile('src/incidents/components/IncidentFormDialog.vue'),
    readProjectFile('src/incidents/components/IncidentMapCaptureTask.vue'),
  ]);

  assert.match(form, /:modal="false"/);
  assert.match(form, /在地图上标注/);
  assert.doesNotMatch(form, /从地图拾取点位|绘制影响范围/);
  assert.match(task, /取消/);
});
