import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import {
  listFiles,
  createFile,
  getFile,
  updateFile,
  deleteFile,
  listSnapshots,
  createSnapshot,
  getSnapshot,
  updateSnapshotLabel,
  deleteSnapshot,
  getPreferences,
  setPreferences,
  getServerToken,
  setServerToken,
} from './api'

type FetchMock = ReturnType<typeof vi.fn>

function mockFetchOnce(payload: unknown, status = 200): FetchMock {
  const fn = vi.fn().mockResolvedValue({
    ok: status >= 200 && status < 300,
    status,
    json: async () => payload,
  })
  global.fetch = fn as unknown as typeof fetch
  return fn
}

beforeEach(() => {
  localStorage.clear()
})

afterEach(() => {
  vi.restoreAllMocks()
  global.fetch = undefined as unknown as typeof fetch
})

describe('getServerToken / setServerToken', () => {
  it('reads a stored token from localStorage', () => {
    expect(getServerToken()).toBeNull()
    setServerToken('secret-token')
    expect(getServerToken()).toBe('secret-token')
    setServerToken(null)
    expect(getServerToken()).toBeNull()
  })
})

describe('listFiles', () => {
  it('returns file summaries from the server', async () => {
    const files = [
      { id: 'a', name: 'api.yaml', language: 'yaml', createdAt: 1, updatedAt: 2 },
    ]
    mockFetchOnce(files)
    const result = await listFiles()
    expect(result).toEqual(files)
    expect(global.fetch).toHaveBeenCalledWith(
      '/api/files',
      expect.objectContaining({ headers: {} }),
    )
  })

  it('sends the bearer token when set', async () => {
    setServerToken('tok')
    mockFetchOnce([])
    await listFiles()
    expect(global.fetch).toHaveBeenCalledWith(
      '/api/files',
      expect.objectContaining({
        headers: { Authorization: 'Bearer tok' },
      }),
    )
  })

  it('throws ApiError when the server is unreachable', async () => {
    global.fetch = vi.fn().mockRejectedValue(new TypeError('Failed to fetch'))
    await expect(listFiles()).rejects.toMatchObject({
      name: 'ApiError',
      status: 0,
    })
  })

  it('throws ApiError with the server message on error status', async () => {
    mockFetchOnce({ error: 'File not found' }, 404)
    await expect(getFile('nope')).rejects.toThrow('File not found')
  })
})

describe('createFile', () => {
  it('posts the payload with a JSON content type', async () => {
    const created = {
      id: 'b',
      name: 'spec.yaml',
      content: 'openapi: 3.0.3',
      language: 'yaml',
      createdAt: 1,
      updatedAt: 1,
    }
    const fn = mockFetchOnce(created, 201)
    const result = await createFile({ name: 'spec.yaml', content: 'openapi: 3.0.3' })
    expect(result).toEqual(created)
    const [, options] = fn.mock.calls[0] as [string, RequestInit]
    expect(options.method).toBe('POST')
    expect(options.headers).toMatchObject({ 'Content-Type': 'application/json' })
    expect(JSON.parse(options.body as string)).toEqual({
      name: 'spec.yaml',
      content: 'openapi: 3.0.3',
    })
  })
})

describe('snapshots', () => {
  const snapshot = {
    id: 's1',
    fileId: 'f1',
    fileName: 'a.yaml',
    content: 'openapi: 3.0.3',
    timestamp: 1,
    hash: 'abc',
  }

  it('createSnapshot returns the snapshot when created', async () => {
    mockFetchOnce({ snapshot }, 201)
    await expect(createSnapshot('f1', snapshot.content, 'v1')).resolves.toEqual(
      snapshot,
    )
  })

  it('createSnapshot returns null on duplicate content', async () => {
    mockFetchOnce({ snapshot: null }, 200)
    await expect(createSnapshot('f1', snapshot.content)).resolves.toBeNull()
  })

  it('listSnapshots returns snapshots sorted by the server', async () => {
    mockFetchOnce([snapshot])
    await expect(listSnapshots('f1')).resolves.toEqual([snapshot])
  })

  it('getSnapshot fetches a single snapshot', async () => {
    mockFetchOnce(snapshot)
    await expect(getSnapshot('s1')).resolves.toEqual(snapshot)
  })

  it('updateSnapshotLabel PUTs the label', async () => {
    const fn = mockFetchOnce({ ok: true })
    await updateSnapshotLabel('s1', 'release')
    const [, options] = fn.mock.calls[0] as [string, RequestInit]
    expect(options.method).toBe('PUT')
    expect(JSON.parse(options.body as string)).toEqual({ label: 'release' })
  })

  it('deleteSnapshot DELETEs the snapshot', async () => {
    const fn = mockFetchOnce({ ok: true })
    await deleteSnapshot('s1')
    const [url, options] = fn.mock.calls[0] as [string, RequestInit]
    expect(url).toBe('/api/snapshots/s1')
    expect(options.method).toBe('DELETE')
  })
})

describe('preferences', () => {
  it('getPreferences returns the stored object', async () => {
    mockFetchOnce({ showPreview: false })
    await expect(getPreferences()).resolves.toEqual({ showPreview: false })
  })

  it('setPreferences PUTs the object', async () => {
    const fn = mockFetchOnce({ showPreview: true })
    await setPreferences({ showPreview: true })
    const [, options] = fn.mock.calls[0] as [string, RequestInit]
    expect(options.method).toBe('PUT')
    expect(JSON.parse(options.body as string)).toEqual({ showPreview: true })
  })
})

describe('updateFile / deleteFile', () => {
  it('updateFile sends a PUT with a JSON body', async () => {
    const fn = mockFetchOnce({ id: 'f1', name: 'x.yaml' })
    await updateFile('f1', { name: 'x.yaml' })
    const [url, options] = fn.mock.calls[0] as [string, RequestInit]
    expect(url).toBe('/api/files/f1')
    expect(options.method).toBe('PUT')
  })

  it('deleteFile sends a DELETE', async () => {
    const fn = mockFetchOnce({ ok: true })
    await deleteFile('f1')
    const [, options] = fn.mock.calls[0] as [string, RequestInit]
    expect(options.method).toBe('DELETE')
  })

  it('throws ApiError with status on failure', async () => {
    mockFetchOnce({ error: 'Unauthorized' }, 401)
    await expect(listFiles()).rejects.toMatchObject({
      name: 'ApiError',
      status: 401,
    })
  })
})
