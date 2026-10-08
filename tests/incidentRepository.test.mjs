import assert from 'node:assert/strict';
import test from 'node:test';
import 'fake-indexeddb/auto';
import { DEFAULT_LOCAL_PROJECT_ID } from '../src/incidents/domain/types.ts';
import {
  IncidentRepositoryError,
  createIndexedDbIncidentRepository,
} from '../src/incidents/repositories/indexedDbIncidentRepository.ts';
import { createDemoIncidentSeed } from '../src/incidents/application/demoData.ts';

const fixedTime = '2026-10-07T09:00:00.000Z';

function createIncident(id) {
  return {
    id,
    schemaVersion: 1,
    projectId: DEFAULT_LOCAL_PROJECT_ID,
    code: `INC-${id}`,
    title: '待处理积水',
    categoryId: 'weather',
    severity: 'high',
    status: 'unassigned',
    geometry: { type: 'Point', coordinates: [139.767, 35.681] },
    createdBy: 'demo-admin',
    createdAt: fixedTime,
    updatedAt: fixedTime,
    version: 1,
  };
}

function createTimeline(incident) {
  return {
    id: `${incident.id}:1:created`,
    schemaVersion: 1,
    projectId: incident.projectId,
    incidentId: incident.id,
    action: 'created',
    actorId: incident.createdBy,
    at: incident.createdAt,
    toStatus: incident.status,
  };
}

function deleteDatabase(name) {
  return new Promise((resolve, reject) => {
    const request = indexedDB.deleteDatabase(name);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
    request.onblocked = () => reject(new Error('database delete blocked'));
  });
}

function openAtVersion(name, version) {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(name, version);
    request.onupgradeneeded = () => request.result.createObjectStore('legacy', { keyPath: 'id' });
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

test('round-trips incidents, timeline, batches, reference data and workspace state through IndexedDB', async () => {
  const dbName = `incident-roundtrip-${Date.now()}-${Math.random()}`;
  const repository = createIndexedDbIncidentRepository({ dbName, indexedDB });
  const seed = createDemoIncidentSeed();
  const incident = createIncident('roundtrip-1');
  const timeline = createTimeline(incident);

  try {
    await repository.initialize(seed);
    await repository.saveIncidentWithTimeline(incident, timeline);
    await repository.saveImportBatch({
      id: 'batch-1',
      schemaVersion: 1,
      projectId: DEFAULT_LOCAL_PROJECT_ID,
      fileName: 'incidents.csv',
      format: 'csv',
      totalCount: 1,
      successCount: 1,
      failureCount: 0,
      errors: [],
      importedAt: fixedTime,
      importedBy: 'demo-admin',
    });
    await repository.saveWorkspaceSnapshot({
      schemaVersion: 1,
      projectId: DEFAULT_LOCAL_PROJECT_ID,
      selectedIncidentId: incident.id,
      statusFilter: ['unassigned'],
      updatedAt: fixedTime,
    });
    repository.close();

    const reopened = createIndexedDbIncidentRepository({ dbName, indexedDB });
    assert.deepEqual(await reopened.getIncident(incident.id), incident);
    assert.deepEqual(await reopened.listTimeline(incident.id), [timeline]);
    assert.equal((await reopened.listImportBatches(DEFAULT_LOCAL_PROJECT_ID))[0].id, 'batch-1');
    assert.equal((await reopened.getWorkspaceSnapshot(DEFAULT_LOCAL_PROJECT_ID)).selectedIncidentId, incident.id);
    assert.ok((await reopened.listDemoUsers()).some((user) => user.role === 'admin'));
    assert.ok((await reopened.listCategories()).some((category) => category.id === 'weather'));
    reopened.close();
  } finally {
    repository.close();
    await deleteDatabase(dbName);
  }
});

test('seeds an empty local database once without overwriting saved incidents', async () => {
  const dbName = `incident-seed-${Date.now()}-${Math.random()}`;
  const repository = createIndexedDbIncidentRepository({ dbName, indexedDB });
  const incident = createIncident('saved-after-seed');

  try {
    await repository.initialize(createDemoIncidentSeed());
    await repository.saveIncidentWithTimeline(incident, createTimeline(incident));
    await repository.initialize({ ...createDemoIncidentSeed(), incidents: [] });

    assert.deepEqual(await repository.getIncident(incident.id), incident);
  } finally {
    repository.close();
    await deleteDatabase(dbName);
  }
});

test('reports unavailable IndexedDB and incompatible schema versions as recoverable repository errors', async () => {
  const unavailable = createIndexedDbIncidentRepository({ dbName: 'no-indexeddb', indexedDB: undefined });
  await assert.rejects(
    unavailable.initialize(createDemoIncidentSeed()),
    (error) => error instanceof IncidentRepositoryError && error.code === 'unavailable',
  );

  const dbName = `incident-migration-${Date.now()}-${Math.random()}`;
  const futureDatabase = await openAtVersion(dbName, 99);
  futureDatabase.close();
  const incompatible = createIndexedDbIncidentRepository({ dbName, indexedDB });
  try {
    await assert.rejects(
      incompatible.initialize(createDemoIncidentSeed()),
      (error) => error instanceof IncidentRepositoryError && error.code === 'migration_failed',
    );
  } finally {
    incompatible.close();
    await deleteDatabase(dbName);
  }
});