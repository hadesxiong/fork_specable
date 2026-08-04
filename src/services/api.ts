import type { VersionSnapshot } from './version-history-db'

const BASE_URL = '/api'

export interface ServerFileSummary {
  id: string
  name: string
  language: 'yaml' | 'json'
  createdAt: number
  updatedAt: number
}

export interface ServerFile extends ServerFileSummary {
  content: string
}

export interface ServerPreferences {
  [key: string]: unknown
}

export interface CreateFilePayload {
  name: string
  content?: string
  language?: 'yaml' | 'json'
}

export interface UpdateFilePayload {
  name?: string
  content?: string
  language?: 'yaml' | 'json'
}

export class ApiError extends Error {
  readonly status: number

  constructor(message: string, status: number) {
    super(message)
    this.name = 'ApiError'
    this.status = status
  }
}

const TOKEN_STORAGE_KEY = 'specable-token'

export function getServerToken(): string | null {
  try {
    const stored = localStorage.getItem(TOKEN_STORAGE_KEY)
    if (stored) return stored
  } catch {
    // Ignore localStorage access failures
  }
  const envToken = (import.meta.env.VITE_SPECABLE_TOKEN as string | undefined)
  return envToken || null
}

export function setServerToken(token: string | null): void {
  try {
    if (token) {
      localStorage.setItem(TOKEN_STORAGE_KEY, token)
    } else {
      localStorage.removeItem(TOKEN_STORAGE_KEY)
    }
  } catch {
    // Ignore localStorage access failures
  }
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = getServerToken()
  const headers: Record<string, string> = {
    ...(options.body ? { 'Content-Type': 'application/json' } : {}),
  }
  if (token) {
    headers['Authorization'] = `Bearer ${token}`
  }

  let response: Response
  try {
    response = await fetch(`${BASE_URL}${path}`, { ...options, headers })
  } catch {
    throw new ApiError('Cannot reach the server. Is it running?', 0)
  }

  if (!response.ok) {
    let message = `Request failed with status ${response.status}`
    try {
      const data = await response.json()
      if (data?.error) message = data.error
    } catch {
      // Ignore non-JSON error bodies
    }
    if (response.status === 401) {
      message = 'Unauthorized - check your server token'
    }
    throw new ApiError(message, response.status)
  }

  if (response.status === 204) {
    return undefined as T
  }

  return (await response.json()) as T
}

export function listFiles(): Promise<ServerFileSummary[]> {
  return request('/files')
}

export function createFile(payload: CreateFilePayload): Promise<ServerFile> {
  return request('/files', {
    method: 'POST',
    body: JSON.stringify(payload),
  })
}

export function getFile(id: string): Promise<ServerFile> {
  return request(`/files/${encodeURIComponent(id)}`)
}

export function updateFile(
  id: string,
  payload: UpdateFilePayload,
): Promise<ServerFile> {
  return request(`/files/${encodeURIComponent(id)}`, {
    method: 'PUT',
    body: JSON.stringify(payload),
  })
}

export function deleteFile(id: string): Promise<{ ok: true }> {
  return request(`/files/${encodeURIComponent(id)}`, { method: 'DELETE' })
}

export function listSnapshots(fileId: string): Promise<VersionSnapshot[]> {
  return request(`/files/${encodeURIComponent(fileId)}/snapshots`)
}

export async function createSnapshot(
  fileId: string,
  content: string,
  label?: string,
): Promise<VersionSnapshot | null> {
  const result = await request<{ snapshot: VersionSnapshot | null }>(
    `/files/${encodeURIComponent(fileId)}/snapshots`,
    {
      method: 'POST',
      body: JSON.stringify({ content, label }),
    },
  )
  return result.snapshot
}

export function getSnapshot(id: string): Promise<VersionSnapshot> {
  return request(`/snapshots/${encodeURIComponent(id)}`)
}

export function updateSnapshotLabel(
  id: string,
  label: string | undefined,
): Promise<{ ok: true }> {
  return request(`/snapshots/${encodeURIComponent(id)}`, {
    method: 'PUT',
    body: JSON.stringify({ label }),
  })
}

export function deleteSnapshot(id: string): Promise<{ ok: true }> {
  return request(`/snapshots/${encodeURIComponent(id)}`, { method: 'DELETE' })
}

export function getPreferences(): Promise<ServerPreferences> {
  return request('/preferences')
}

export function setPreferences(
  preferences: ServerPreferences,
): Promise<ServerPreferences> {
  return request('/preferences', {
    method: 'PUT',
    body: JSON.stringify(preferences),
  })
}

export function checkHealth(): Promise<{ ok: true }> {
  return request('/health')
}
