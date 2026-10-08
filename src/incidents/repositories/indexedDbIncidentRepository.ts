import type {
  DemoUser,
  Incident,
  IncidentCategory,
  IncidentTimelineEntry,
  ImportBatch,
  IncidentWorkspaceSnapshot,
} from '../domain/types.ts';
import { INCIDENT_SCHEMA_VERSION } from '../domain/types.ts';
import type { IncidentDemoSeed, IncidentWorkspaceRepository } from './contracts.ts';

const DATABASE_VERSION = 1;
const stores = {
  incidents: 'incidents',
  timeline: 'timeline',
  importBatches: 'importBatches',
  users: 'users',
  categories: 'categories',
  settings: 'settings',
} as const;
const initializedSettingKey = '__incident_workspace_initialized__';
const workspaceSettingPrefix = 'workspace:';

type StoreName = (typeof stores)[keyof typeof stores];
type StoredSetting = { key: string; schemaVersion: typeof INCIDENT_SCHEMA_VERSION; value: unknown };

export type IncidentRepositoryErrorCode = 'unavailable' | 'migration_failed' | 'operation_failed';

export class IncidentRepositoryError extends Error {
  public readonly code: IncidentRepositoryErrorCode;
  public readonly originalError?: unknown;

  constructor(code: IncidentRepositoryErrorCode, message: string, originalError?: unknown) {
    super(message);
    this.name = 'IncidentRepositoryError';
    this.code = code;
    this.originalError = originalError;
  }
}

export interface IndexedDbIncidentRepositoryOptions {
  dbName?: string;
  indexedDB?: IDBFactory;
}

function requestResult<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error('IndexedDB request failed'));
  });
}

function transactionComplete(transaction: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error ?? new Error('IndexedDB transaction failed'));
    transaction.onabort = () => reject(transaction.error ?? new Error('IndexedDB transaction aborted'));
  });
}

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

export class IndexedDbIncidentRepository implements IncidentWorkspaceRepository {
  private database?: IDBDatabase;
  private opening?: Promise<IDBDatabase>;
  private readonly dbName: string;
  private readonly factory?: IDBFactory;

  constructor(options: IndexedDbIncidentRepositoryOptions = {}) {
    this.dbName = options.dbName ?? 'graphite-atlas-incidents';
    this.factory = Object.prototype.hasOwnProperty.call(options, 'indexedDB') ? options.indexedDB : globalThis.indexedDB;
  }

  private async open(): Promise<IDBDatabase> {
    if (this.database) return this.database;
    if (!this.factory) throw new IncidentRepositoryError('unavailable', '当前浏览器不支持 IndexedDB，无法恢复本地事件数据。');
    if (this.opening) return this.opening;

    this.opening = new Promise<IDBDatabase>((resolve, reject) => {
      let request: IDBOpenDBRequest;
      try {
        request = this.factory!.open(this.dbName, DATABASE_VERSION);
      } catch (error) {
        reject(new IncidentRepositoryError('migration_failed', '本地事件数据库无法打开或迁移。', error));
        return;
      }
      request.onupgradeneeded = () => {
        const database = request.result;
        try {
          if (!database.objectStoreNames.contains(stores.incidents)) {
            const store = database.createObjectStore(stores.incidents, { keyPath: 'id' });
            store.createIndex('projectId', 'projectId', { unique: false });
          }
          if (!database.objectStoreNames.contains(stores.timeline)) {
            const store = database.createObjectStore(stores.timeline, { keyPath: 'id' });
            store.createIndex('incidentId', 'incidentId', { unique: false });
            store.createIndex('projectId', 'projectId', { unique: false });
          }
          if (!database.objectStoreNames.contains(stores.importBatches)) {
            const store = database.createObjectStore(stores.importBatches, { keyPath: 'id' });
            store.createIndex('projectId', 'projectId', { unique: false });
          }
          if (!database.objectStoreNames.contains(stores.users)) database.createObjectStore(stores.users, { keyPath: 'id' });
          if (!database.objectStoreNames.contains(stores.categories)) database.createObjectStore(stores.categories, { keyPath: 'id' });
          if (!database.objectStoreNames.contains(stores.settings)) database.createObjectStore(stores.settings, { keyPath: 'key' });
        } catch (error) {
          request.transaction?.abort();
          reject(new IncidentRepositoryError('migration_failed', '本地事件数据库迁移失败。', error));
        }
      };
      request.onsuccess = () => {
        const database = request.result;
        database.onversionchange = () => this.close();
        this.database = database;
        resolve(database);
      };
      request.onerror = () => reject(new IncidentRepositoryError('migration_failed', '本地事件数据库无法打开或迁移。', request.error));
      request.onblocked = () => reject(new IncidentRepositoryError('migration_failed', '本地事件数据库被其他页面占用。'));
    });

    try {
      return await this.opening;
    } catch (error) {
      this.opening = undefined;
      throw error;
    }
  }

  private async run<T>(operation: () => Promise<T>): Promise<T> {
    try {
      return await operation();
    } catch (error) {
      if (error instanceof IncidentRepositoryError) throw error;
      throw new IncidentRepositoryError('operation_failed', '本地事件数据操作失败。', error);
    }
  }

  private async getAll<T>(storeName: StoreName): Promise<T[]> {
    return this.run(async () => {
      const database = await this.open();
      const transaction = database.transaction(storeName, 'readonly');
      const values = await requestResult(transaction.objectStore(storeName).getAll() as IDBRequest<T[]>);
      await transactionComplete(transaction);
      return values.map(clone);
    });
  }

  private async write(transactionStores: StoreName[], writer: (transaction: IDBTransaction) => void): Promise<void> {
    return this.run(async () => {
      const database = await this.open();
      const transaction = database.transaction(transactionStores, 'readwrite');
      writer(transaction);
      await transactionComplete(transaction);
    });
  }

  private async settingRecord(key: string): Promise<StoredSetting | undefined> {
    return this.run(async () => {
      const database = await this.open();
      const transaction = database.transaction(stores.settings, 'readonly');
      const value = await requestResult(transaction.objectStore(stores.settings).get(key) as IDBRequest<StoredSetting | undefined>);
      await transactionComplete(transaction);
      return value ? clone(value) : undefined;
    });
  }

  async initialize(seed: IncidentDemoSeed): Promise<void> {
    await this.open();
    if (await this.settingRecord(initializedSettingKey)) return;
    await this.write(Object.values(stores), (transaction) => {
      const incidentStore = transaction.objectStore(stores.incidents);
      const timelineStore = transaction.objectStore(stores.timeline);
      const batchStore = transaction.objectStore(stores.importBatches);
      const userStore = transaction.objectStore(stores.users);
      const categoryStore = transaction.objectStore(stores.categories);
      const settingStore = transaction.objectStore(stores.settings);
      seed.incidents.forEach((item) => incidentStore.put(clone(item)));
      seed.timeline.forEach((item) => timelineStore.put(clone(item)));
      seed.importBatches.forEach((item) => batchStore.put(clone(item)));
      seed.users.forEach((item) => userStore.put(clone(item)));
      seed.categories.forEach((item) => categoryStore.put(clone(item)));
      seed.workspaceSnapshots?.forEach((item) => settingStore.put({ key: `${workspaceSettingPrefix}${item.projectId}`, schemaVersion: INCIDENT_SCHEMA_VERSION, value: clone(item) } satisfies StoredSetting));
      settingStore.put({ key: initializedSettingKey, schemaVersion: INCIDENT_SCHEMA_VERSION, value: true } satisfies StoredSetting);
    });
  }

  async reset(seed: IncidentDemoSeed): Promise<void> {
    await this.write(Object.values(stores), (transaction) => {
      Object.values(stores).forEach((name) => transaction.objectStore(name).clear());
      const incidentStore = transaction.objectStore(stores.incidents);
      const timelineStore = transaction.objectStore(stores.timeline);
      const batchStore = transaction.objectStore(stores.importBatches);
      const userStore = transaction.objectStore(stores.users);
      const categoryStore = transaction.objectStore(stores.categories);
      const settingStore = transaction.objectStore(stores.settings);
      seed.incidents.forEach((item) => incidentStore.put(clone(item)));
      seed.timeline.forEach((item) => timelineStore.put(clone(item)));
      seed.importBatches.forEach((item) => batchStore.put(clone(item)));
      seed.users.forEach((item) => userStore.put(clone(item)));
      seed.categories.forEach((item) => categoryStore.put(clone(item)));
      seed.workspaceSnapshots?.forEach((item) => settingStore.put({ key: `${workspaceSettingPrefix}${item.projectId}`, schemaVersion: INCIDENT_SCHEMA_VERSION, value: clone(item) } satisfies StoredSetting));
      settingStore.put({ key: initializedSettingKey, schemaVersion: INCIDENT_SCHEMA_VERSION, value: true } satisfies StoredSetting);
    });
  }

  async listIncidents(projectId: string): Promise<Incident[]> {
    return (await this.getAll<Incident>(stores.incidents)).filter((item) => item.projectId === projectId).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  }

  async getIncident(id: string): Promise<Incident | undefined> {
    return this.run(async () => {
      const database = await this.open();
      const transaction = database.transaction(stores.incidents, 'readonly');
      const value = await requestResult(transaction.objectStore(stores.incidents).get(id) as IDBRequest<Incident | undefined>);
      await transactionComplete(transaction);
      return value ? clone(value) : undefined;
    });
  }

  async saveIncidentWithTimeline(incident: Incident, timeline: IncidentTimelineEntry): Promise<void> {
    await this.write([stores.incidents, stores.timeline], (transaction) => {
      transaction.objectStore(stores.incidents).put(clone(incident));
      transaction.objectStore(stores.timeline).put(clone(timeline));
    });
  }

  async listTimeline(incidentId: string): Promise<IncidentTimelineEntry[]> {
    return (await this.getAll<IncidentTimelineEntry>(stores.timeline)).filter((item) => item.incidentId === incidentId).sort((a, b) => a.at.localeCompare(b.at));
  }

  async saveImportBatch(batch: ImportBatch): Promise<void> {
    await this.write([stores.importBatches], (transaction) => transaction.objectStore(stores.importBatches).put(clone(batch)));
  }

  async getImportBatch(id: string): Promise<ImportBatch | undefined> {
    return this.run(async () => {
      const database = await this.open();
      const transaction = database.transaction(stores.importBatches, 'readonly');
      const value = await requestResult(transaction.objectStore(stores.importBatches).get(id) as IDBRequest<ImportBatch | undefined>);
      await transactionComplete(transaction);
      return value ? clone(value) : undefined;
    });
  }

  async listImportBatches(projectId: string): Promise<ImportBatch[]> {
    return (await this.getAll<ImportBatch>(stores.importBatches)).filter((item) => item.projectId === projectId).sort((a, b) => b.importedAt.localeCompare(a.importedAt));
  }

  async deleteIncidentsWithTimeline(incidentIds: string[]): Promise<void> {
    const ids = new Set(incidentIds);
    await this.write([stores.incidents, stores.timeline], (transaction) => {
      const incidentStore = transaction.objectStore(stores.incidents);
      incidentIds.forEach((id) => incidentStore.delete(id));
      const timelineStore = transaction.objectStore(stores.timeline);
      const request = timelineStore.getAll();
      request.onsuccess = () => (request.result as IncidentTimelineEntry[]).filter((entry) => ids.has(entry.incidentId)).forEach((entry) => timelineStore.delete(entry.id));
    });
  }

  async listDemoUsers(): Promise<DemoUser[]> { return this.getAll<DemoUser>(stores.users); }

  async replaceDemoUsers(users: DemoUser[]): Promise<void> {
    await this.write([stores.users], (transaction) => {
      const store = transaction.objectStore(stores.users);
      store.clear();
      users.forEach((item) => store.put(clone(item)));
    });
  }

  async listCategories(): Promise<IncidentCategory[]> { return this.getAll<IncidentCategory>(stores.categories); }

  async replaceCategories(categories: IncidentCategory[]): Promise<void> {
    await this.write([stores.categories], (transaction) => {
      const store = transaction.objectStore(stores.categories);
      store.clear();
      categories.forEach((item) => store.put(clone(item)));
    });
  }

  async getWorkspaceSnapshot(projectId: string): Promise<IncidentWorkspaceSnapshot | undefined> {
    return this.getSetting<IncidentWorkspaceSnapshot>(`${workspaceSettingPrefix}${projectId}`);
  }

  async saveWorkspaceSnapshot(snapshot: IncidentWorkspaceSnapshot): Promise<void> {
    await this.setSetting(`${workspaceSettingPrefix}${snapshot.projectId}`, snapshot);
  }

  async getSetting<T>(key: string): Promise<T | undefined> {
    const record = await this.settingRecord(key);
    return record ? clone(record.value as T) : undefined;
  }

  async setSetting<T>(key: string, value: T): Promise<void> {
    await this.write([stores.settings], (transaction) => {
      transaction.objectStore(stores.settings).put({ key, schemaVersion: INCIDENT_SCHEMA_VERSION, value: clone(value) } satisfies StoredSetting);
    });
  }

  close(): void {
    this.database?.close();
    this.database = undefined;
    this.opening = undefined;
  }
}

export function createIndexedDbIncidentRepository(options: IndexedDbIncidentRepositoryOptions = {}): IncidentWorkspaceRepository {
  return new IndexedDbIncidentRepository(options);
}
