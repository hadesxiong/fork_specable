export interface VersionSnapshot {
  id: string;
  fileId: string;
  fileName: string;
  content: string;
  timestamp: number;
  hash: string;
  label?: string;
}

const DB_NAME = 'specable-history';
const DB_VERSION = 1;
const STORE_NAME = 'snapshots';

async function hashContent(content: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(content);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(hashBuffer))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
}

class VersionHistoryDB {
  private db: IDBDatabase | null = null;
  private initPromise: Promise<void> | null = null;

  async init(): Promise<void> {
    if (this.db) return;
    if (this.initPromise) return this.initPromise;

    this.initPromise = new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);

      request.onerror = () => {
        console.error('Failed to open version history database:', request.error);
        reject(request.error);
      };

      request.onsuccess = () => {
        this.db = request.result;
        resolve();
      };

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;

        if (!db.objectStoreNames.contains(STORE_NAME)) {
          const store = db.createObjectStore(STORE_NAME, { keyPath: 'id' });
          store.createIndex('fileId', 'fileId', { unique: false });
          store.createIndex('timestamp', 'timestamp', { unique: false });
          store.createIndex('hash', 'hash', { unique: false });
          store.createIndex('fileId_timestamp', ['fileId', 'timestamp'], { unique: false });
        }
      };
    });

    return this.initPromise;
  }

  private async ensureDb(): Promise<IDBDatabase> {
    await this.init();
    if (!this.db) {
      throw new Error('Database not initialised');
    }
    return this.db;
  }

  private async withTransaction<T>(
    mode: IDBTransactionMode,
    operation: (store: IDBObjectStore) => IDBRequest
  ): Promise<T> {
    const db = await this.ensureDb();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(STORE_NAME, mode);
      const store = transaction.objectStore(STORE_NAME);
      const request = operation(store);

      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  async saveSnapshot(
    fileId: string,
    fileName: string,
    content: string,
    label?: string
  ): Promise<VersionSnapshot | null> {
    const hash = await hashContent(content);

    // Check for duplicate content
    const existing = await this.findByHash(fileId, hash);
    if (existing) {
      return null; // Skip duplicate
    }

    const snapshot: VersionSnapshot = {
      id: crypto.randomUUID(),
      fileId,
      fileName,
      content,
      timestamp: Date.now(),
      hash,
      label,
    };

    await this.withTransaction<IDBValidKey>('readwrite', (store) => store.add(snapshot));
    return snapshot;
  }

  private async findByHash(fileId: string, hash: string): Promise<VersionSnapshot | null> {
    const db = await this.ensureDb();

    return new Promise((resolve, reject) => {
      const transaction = db.transaction(STORE_NAME, 'readonly');
      const store = transaction.objectStore(STORE_NAME);
      const index = store.index('hash');
      const request = index.getAll(hash);

      request.onsuccess = () => {
        const matches = request.result.filter(
          (s: VersionSnapshot) => s.fileId === fileId
        );
        resolve(matches.length > 0 ? matches[0] : null);
      };
      request.onerror = () => reject(request.error);
    });
  }

  async getSnapshots(fileId: string): Promise<VersionSnapshot[]> {
    const db = await this.ensureDb();

    return new Promise((resolve, reject) => {
      const transaction = db.transaction(STORE_NAME, 'readonly');
      const store = transaction.objectStore(STORE_NAME);
      const index = store.index('fileId');
      const request = index.getAll(fileId);

      request.onsuccess = () => {
        const snapshots = request.result as VersionSnapshot[];
        // Sort by timestamp descending (newest first)
        snapshots.sort((a, b) => b.timestamp - a.timestamp);
        resolve(snapshots);
      };
      request.onerror = () => reject(request.error);
    });
  }

  async getSnapshot(id: string): Promise<VersionSnapshot | null> {
    const result = await this.withTransaction<VersionSnapshot | undefined>(
      'readonly',
      (store) => store.get(id)
    );
    return result ?? null;
  }

  async deleteSnapshot(id: string): Promise<void> {
    await this.withTransaction<undefined>('readwrite', (store) => store.delete(id));
  }

  async updateSnapshotLabel(id: string, label: string | undefined): Promise<void> {
    const snapshot = await this.getSnapshot(id);
    if (!snapshot) return;

    snapshot.label = label;
    await this.withTransaction<IDBValidKey>('readwrite', (store) => store.put(snapshot));
  }

  async pruneOldSnapshots(fileId: string, keepCount: number = 50): Promise<number> {
    const snapshots = await this.getSnapshots(fileId);

    if (snapshots.length <= keepCount) {
      return 0;
    }

    // Keep the newest ones, delete the rest
    const toDelete = snapshots.slice(keepCount);
    let deletedCount = 0;

    for (const snapshot of toDelete) {
      await this.deleteSnapshot(snapshot.id);
      deletedCount++;
    }

    return deletedCount;
  }

  async clearAllSnapshots(fileId: string): Promise<void> {
    const snapshots = await this.getSnapshots(fileId);
    for (const snapshot of snapshots) {
      await this.deleteSnapshot(snapshot.id);
    }
  }
}

let instance: VersionHistoryDB | null = null;

export function getVersionHistoryDB(): VersionHistoryDB {
  if (!instance) {
    instance = new VersionHistoryDB();
  }
  return instance;
}

export { hashContent };
