import {
  listSnapshots,
  createSnapshot,
  getSnapshot,
  updateSnapshotLabel,
  deleteSnapshot,
} from './api'

export interface VersionSnapshot {
  id: string
  fileId: string
  fileName: string
  content: string
  timestamp: number
  hash: string
  label?: string
}

const MAX_SNAPSHOTS = 50

async function hashContent(content: string): Promise<string> {
  const encoder = new TextEncoder()
  const data = encoder.encode(content)
  const hashBuffer = await crypto.subtle.digest('SHA-256', data)
  return Array.from(new Uint8Array(hashBuffer))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
}

class VersionHistoryDB {
  async init(): Promise<void> {
    // Server-backed: no local database to initialise
  }

  async saveSnapshot(
    _fileId: string,
    _fileName: string,
    content: string,
    label?: string,
  ): Promise<VersionSnapshot | null> {
    return createSnapshot(_fileId, content, label)
  }

  async getSnapshots(fileId: string): Promise<VersionSnapshot[]> {
    return listSnapshots(fileId)
  }

  async getSnapshot(id: string): Promise<VersionSnapshot | null> {
    try {
      return await getSnapshot(id)
    } catch {
      return null
    }
  }

  async deleteSnapshot(id: string): Promise<void> {
    await deleteSnapshot(id)
  }

  async updateSnapshotLabel(
    id: string,
    label: string | undefined,
  ): Promise<void> {
    await updateSnapshotLabel(id, label)
  }

  async pruneOldSnapshots(
    _fileId: string,
    _keepCount = MAX_SNAPSHOTS,
  ): Promise<number> {
    void _fileId
    void _keepCount
    // Pruning is handled server-side when creating snapshots
    return 0
  }

  async clearAllSnapshots(fileId: string): Promise<void> {
    const snapshots = await this.getSnapshots(fileId)
    for (const snapshot of snapshots) {
      await this.deleteSnapshot(snapshot.id)
    }
  }
}

let instance: VersionHistoryDB | null = null

export function getVersionHistoryDB(): VersionHistoryDB {
  if (!instance) {
    instance = new VersionHistoryDB()
  }
  return instance
}

export { hashContent }
