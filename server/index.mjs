import { createServer } from 'node:http'
import { promises as fs, existsSync } from 'node:fs'
import { join, extname, normalize, resolve, sep } from 'node:path'
import { fileURLToPath } from 'node:url'
import { Store } from './lib/store.mjs'

const __dirname = fileURLToPath(new URL('.', import.meta.url))

const PORT = Number(process.env.SPECABLE_PORT || 8787)
const DATA_DIR =
  process.env.SPECABLE_DATA_DIR || join(process.cwd(), 'data')
const DIST_DIR =
  process.env.SPECABLE_DIST_DIR || resolve(__dirname, '..', 'dist')
const TOKEN = process.env.SPECABLE_TOKEN || null

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.map': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf',
  '.otf': 'font/otf',
  '.webmanifest': 'application/manifest+json',
}

const store = new Store(DATA_DIR)
await store.load()

function readBody(req) {
  return new Promise((resolveBody, reject) => {
    let body = ''
    req.on('data', (chunk) => {
      body += chunk
      if (body.length > 50 * 1024 * 1024) {
        reject(new Error('Request body too large'))
        req.destroy()
      }
    })
    req.on('end', () => resolveBody(body))
    req.on('error', reject)
  })
}

function parseJsonBody(raw) {
  if (!raw) return {}
  try {
    return JSON.parse(raw)
  } catch {
    const error = new Error('Invalid JSON body')
    error.status = 400
    throw error
  }
}

function sendJson(res, status, data) {
  const body = JSON.stringify(data)
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8' })
  res.end(body)
  return true
}

function sendError(res, status, message) {
  return sendJson(res, status, { error: message })
}

function isAuthorized(req) {
  if (!TOKEN) return true
  const header = req.headers.authorization || ''
  return header === `Bearer ${TOKEN}`
}

function route(pattern) {
  return (pathname) => {
    const segments = pathname.split('/').filter(Boolean)
    if (pattern.length !== segments.length) return null
    const params = {}
    for (let i = 0; i < pattern.length; i++) {
      const part = pattern[i]
      if (part.startsWith(':')) {
        params[part.slice(1)] = decodeURIComponent(segments[i])
      } else if (part !== segments[i]) {
        return null
      }
    }
    return params
  }
}

async function handleApi(req, res, pathname) {
  if (!pathname.startsWith('/api/')) return false

  if (!isAuthorized(req)) {
    sendError(res, 401, 'Unauthorized')
    return true
  }

  const method = req.method

  try {
    if (pathname === '/api/health') {
      return sendJson(res, 200, { ok: true })
    }

    const needsBody = method === 'POST' || method === 'PUT'
    const rawBody = needsBody ? await readBody(req) : ''
    const body = parseJsonBody(rawBody)

    if (pathname === '/api/preferences') {
      if (method === 'GET') {
        return sendJson(res, 200, store.getPreferences())
      }
      if (method === 'PUT') {
        const prefs = await store.setPreferences(body)
        return sendJson(res, 200, prefs)
      }
      return sendError(res, 405, 'Method not allowed')
    }

    if (pathname === '/api/files') {
      if (method === 'GET') {
        return sendJson(res, 200, store.listFiles())
      }
      if (method === 'POST') {
        if (typeof body.name !== 'string' || !body.name.trim()) {
          return sendError(res, 400, 'File name is required')
        }
        const file = await store.createFile(body)
        return sendJson(res, 201, file)
      }
      return sendError(res, 405, 'Method not allowed')
    }

    const fileRoute = route(['api', 'files', ':id'])
    const fileParams = fileRoute(pathname)
    if (fileParams) {
      const { id } = fileParams
      if (method === 'GET') {
        const file = store.getFile(id)
        if (!file) return sendError(res, 404, 'File not found')
        return sendJson(res, 200, file)
      }
      if (method === 'PUT') {
        const file = await store.updateFile(id, body)
        if (!file) return sendError(res, 404, 'File not found')
        return sendJson(res, 200, file)
      }
      if (method === 'DELETE') {
        const deleted = await store.deleteFile(id)
        if (!deleted) return sendError(res, 404, 'File not found')
        return sendJson(res, 200, { ok: true })
      }
      return sendError(res, 405, 'Method not allowed')
    }

    const snapshotsRoute = route(['api', 'files', ':id', 'snapshots'])
    const snapshotsParams = snapshotsRoute(pathname)
    if (snapshotsParams) {
      const { id } = snapshotsParams
      if (method === 'GET') {
        return sendJson(res, 200, store.listSnapshots(id))
      }
      if (method === 'POST') {
        if (typeof body.content !== 'string') {
          return sendError(res, 400, 'Snapshot content is required')
        }
        if (!store.getFile(id)) {
          return sendError(res, 404, 'File not found')
        }
        const snapshot = await store.createSnapshot(id, {
          content: body.content,
          label: body.label,
        })
        if (snapshot === null) {
          return sendJson(res, 200, { snapshot: null })
        }
        return sendJson(res, 201, { snapshot })
      }
      return sendError(res, 405, 'Method not allowed')
    }

    const snapshotRoute = route(['api', 'snapshots', ':sid'])
    const snapshotParams = snapshotRoute(pathname)
    if (snapshotParams) {
      const { sid } = snapshotParams
      if (method === 'GET') {
        const snapshot = store.getSnapshot(sid)
        if (!snapshot) return sendError(res, 404, 'Snapshot not found')
        return sendJson(res, 200, snapshot)
      }
      if (method === 'PUT') {
        const updated = await store.updateSnapshotLabel(sid, body.label)
        if (!updated) return sendError(res, 404, 'Snapshot not found')
        return sendJson(res, 200, { ok: true })
      }
      if (method === 'DELETE') {
        const deleted = await store.deleteSnapshot(sid)
        if (!deleted) return sendError(res, 404, 'Snapshot not found')
        return sendJson(res, 200, { ok: true })
      }
      return sendError(res, 405, 'Method not allowed')
    }

    return sendError(res, 404, 'Not found')
  } catch (error) {
    console.error(`[specable] ${method} ${pathname} failed:`, error)
    const status = error.status || 500
    sendError(res, status, error.message || 'Internal server error')
    return true
  }
}

async function serveStatic(req, res, pathname) {
  let path = pathname
  if (path === '/') path = '/index.html'
  if (path.startsWith('/')) path = path.slice(1)

  const distRoot = resolve(DIST_DIR)
  const resolved = normalize(resolve(distRoot, path))
  if (resolved !== distRoot && !resolved.startsWith(distRoot + sep)) {
    return sendError(res, 403, 'Forbidden')
  }

  const ext = extname(resolved)
  const isAsset = MIME_TYPES[ext] !== undefined

  if (isAsset && existsSync(resolved)) {
    const data = await fs.readFile(resolved)
    res.writeHead(200, { 'Content-Type': MIME_TYPES[ext] })
    return res.end(data)
  }

  if (!isAsset && existsSync(resolved)) {
    const stat = await fs.stat(resolved)
    if (stat.isFile()) {
      const data = await fs.readFile(resolved)
      res.writeHead(200, { 'Content-Type': MIME_TYPES[ext] || 'application/octet-stream' })
      return res.end(data)
    }
  }

  // SPA fallback
  const indexPath = join(DIST_DIR, 'index.html')
  if (existsSync(indexPath)) {
    const data = await fs.readFile(indexPath)
    res.writeHead(200, { 'Content-Type': MIME_TYPES['.html'] })
    return res.end(data)
  }

  sendError(res, 404, 'Not found')
}

const server = createServer(async (req, res) => {
  try {
    const url = new URL(req.url, 'http://localhost')
    const handled = await handleApi(req, res, url.pathname)
    if (handled) return
    await serveStatic(req, res, url.pathname)
  } catch (error) {
    console.error('[specable] request failed:', error)
    if (!res.headersSent) {
      sendError(res, 500, 'Internal server error')
    } else {
      res.end()
    }
  }
})

server.listen(PORT, () => {
  console.log(`[specable] Server listening on http://localhost:${PORT}`)
  console.log(`[specable] Data directory: ${DATA_DIR}`)
  console.log(`[specable] Static files: ${DIST_DIR}`)
  if (TOKEN) {
    console.log('[specable] Bearer token authentication enabled')
  } else {
    console.log('[specable] Authentication disabled (no SPECABLE_TOKEN set)')
  }
})
