import { promises as fs } from 'node:fs'
import { randomUUID, createHash } from 'node:crypto'
import { join } from 'node:path'

export const MAX_SNAPSHOTS = 50

function sha256(content) {
  return createHash('sha256').update(content, 'utf8').digest('hex')
}

function detectLanguage(name, content) {
  if (name.endsWith('.json')) return 'json'
  if (name.endsWith('.yaml') || name.endsWith('.yml')) return 'yaml'
  const trimmed = (content || '').trim()
  if (trimmed.startsWith('{') || trimmed.startsWith('[')) return 'json'
  return 'yaml'
}

function toSummary(file) {
  return {
    id: file.id,
    name: file.name,
    language: file.language,
    createdAt: file.createdAt,
    updatedAt: file.updatedAt,
  }
}

export class Store {
  constructor(dataDir) {
    this.dataDir = dataDir
    this.dbPath = join(dataDir, 'db.json')
    this.data = { version: 1, files: {}, snapshots: {}, preferences: {} }
    this.loaded = false
  }

  async load() {
    if (this.loaded) return
    await fs.mkdir(this.dataDir, { recursive: true })
    try {
      const raw = await fs.readFile(this.dbPath, 'utf8')
      const parsed = JSON.parse(raw)
      this.data = {
        version: 1,
        files: parsed.files ?? {},
        snapshots: parsed.snapshots ?? {},
        preferences: parsed.preferences ?? {},
      }
    } catch (error) {
      if (error.code === 'ENOENT') {
        // First run - fresh database
      } else {
        const backupPath = join(
          this.dataDir,
          `db.json.corrupt-${Date.now()}`,
        )
        try {
          await fs.rename(this.dbPath, backupPath)
        } catch {
          // Ignore backup failure
        }
        console.error(
          `[specable] db.json is corrupt, backed up to ${backupPath}: ${error.message}`,
        )
      }
    }
    this.loaded = true
  }

  async persist() {
    await this.load()
    const tmpPath = `${this.dbPath}.tmp`
    await fs.writeFile(tmpPath, JSON.stringify(this.data, null, 2), 'utf8')
    await fs.rename(tmpPath, this.dbPath)
  }

  listFiles() {
    return Object.values(this.data.files)
      .map(toSummary)
      .sort((a, b) => a.name.localeCompare(b.name))
  }

  getFile(id) {
    const file = this.data.files[id]
    return file ? { ...file } : null
  }

  async createFile({ name, content = '', language }) {
    if (!name || typeof name !== 'string') {
      throw new TypeError('File name is required')
    }
    const id = randomUUID()
    const now = Date.now()
    const file = {
      id,
      name,
      content,
      language: language ?? detectLanguage(name, content),
      createdAt: now,
      updatedAt: now,
    }
    this.data.files[id] = file
    await this.persist()
    return { ...file }
  }

  async updateFile(id, patch = {}) {
    const file = this.data.files[id]
    if (!file) return null
    if (patch.name !== undefined) file.name = patch.name
    if (patch.content !== undefined) file.content = patch.content
    if (patch.language !== undefined) file.language = patch.language
    file.updatedAt = Date.now()
    await this.persist()
    return { ...file }
  }

  async deleteFile(id) {
    if (!this.data.files[id]) return false
    delete this.data.files[id]
    delete this.data.snapshots[id]
    await this.persist()
    return true
  }

  listSnapshots(fileId) {
    const list = this.data.snapshots[fileId] ?? []
    return [...list].sort((a, b) => b.timestamp - a.timestamp)
  }

  getSnapshot(id) {
    for (const list of Object.values(this.data.snapshots)) {
      const found = list.find((s) => s.id === id)
      if (found) return { ...found }
    }
    return null
  }

  async createSnapshot(fileId, { content, label }) {
    const file = this.data.files[fileId]
    if (!file) return null
    const hash = sha256(content)
    const list = this.data.snapshots[fileId] ?? []
    if (list.some((s) => s.hash === hash)) return null
    const snapshot = {
      id: randomUUID(),
      fileId,
      fileName: file.name,
      content,
      timestamp: Date.now(),
      hash,
    }
    if (label !== undefined && label !== '') snapshot.label = label
    list.push(snapshot)
    list.sort((a, b) => b.timestamp - a.timestamp)
    if (list.length > MAX_SNAPSHOTS) {
      list.length = MAX_SNAPSHOTS
    }
    this.data.snapshots[fileId] = list
    await this.persist()
    return { ...snapshot }
  }

  async updateSnapshotLabel(id, label) {
    const snapshot = this.getSnapshot(id)
    if (!snapshot) return false
    const list = this.data.snapshots[snapshot.fileId]
    const target = list.find((s) => s.id === id)
    if (!target) return false
    if (label === undefined || label === '') {
      delete target.label
    } else {
      target.label = label
    }
    await this.persist()
    return true
  }

  async deleteSnapshot(id) {
    const snapshot = this.getSnapshot(id)
    if (!snapshot) return false
    const list = this.data.snapshots[snapshot.fileId]
    const next = list.filter((s) => s.id !== id)
    this.data.snapshots[snapshot.fileId] = next
    await this.persist()
    return true
  }

  getPreferences() {
    return { ...(this.data.preferences ?? {}) }
  }

  async setPreferences(preferences) {
    this.data.preferences = preferences ?? {}
    await this.persist()
    return this.getPreferences()
  }
}
