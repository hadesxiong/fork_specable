import { test, describe, beforeEach, afterEach } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { Store, MAX_SNAPSHOTS } from './store.mjs'

const CONTENT = `openapi: 3.0.3
info:
  title: Test API
  version: 1.0.0
paths: {}
`

function makeStore() {
  const dir = mkdtempSync(join(tmpdir(), 'specable-test-'))
  return { store: new Store(dir), dir }
}

describe('store', () => {
  let ctx

  beforeEach(async () => {
    ctx = makeStore()
    await ctx.store.load()
  })

  afterEach(() => {
    rmSync(ctx.dir, { recursive: true, force: true })
  })

  test('creates, lists, gets, updates and deletes files', async () => {
    const created = await ctx.store.createFile({ name: 'api.yaml', content: CONTENT })
    assert.ok(created.id)
    assert.equal(created.name, 'api.yaml')
    assert.equal(created.language, 'yaml')

    const listed = ctx.store.listFiles()
    assert.equal(listed.length, 1)
    assert.equal(listed[0].name, 'api.yaml')
    assert.equal(listed[0].content, undefined, 'summaries must not include content')

    const fetched = ctx.store.getFile(created.id)
    assert.equal(fetched.content, CONTENT)

    const updated = await ctx.store.updateFile(created.id, { name: 'renamed.yaml' })
    assert.equal(updated.name, 'renamed.yaml')

    assert.equal(ctx.store.getFile('missing'), null)

    const deleted = await ctx.store.deleteFile(created.id)
    assert.equal(deleted, true)
    assert.equal(ctx.store.getFile(created.id), null)
    assert.equal(await ctx.store.deleteFile(created.id), false)
  })

  test('detects language from content when not provided', async () => {
    const jsonFile = await ctx.store.createFile({
      name: 'spec',
      content: '{"openapi":"3.0.3"}',
    })
    assert.equal(jsonFile.language, 'json')
  })

  test('rejects file creation without a name', async () => {
    await assert.rejects(() => ctx.store.createFile({ content: CONTENT }))
  })

  test('snapshots are deduplicated by content hash', async () => {
    const file = await ctx.store.createFile({ name: 'api.yaml', content: CONTENT })

    const first = await ctx.store.createSnapshot(file.id, { content: CONTENT })
    assert.ok(first)
    assert.equal(first.fileName, 'api.yaml')
    assert.ok(first.hash)

    const duplicate = await ctx.store.createSnapshot(file.id, { content: CONTENT })
    assert.equal(duplicate, null)

    const changed = await ctx.store.createSnapshot(file.id, {
      content: `${CONTENT}info:\n  description: changed\n`,
    })
    assert.ok(changed)
  })

  test('snapshots are listed newest first and labelled', async () => {
    const file = await ctx.store.createFile({ name: 'api.yaml', content: CONTENT })
    await ctx.store.createSnapshot(file.id, { content: CONTENT })
    const snap = await ctx.store.createSnapshot(file.id, {
      content: `${CONTENT}\n# second`,
      label: 'release',
    })

    const list = ctx.store.listSnapshots(file.id)
    assert.equal(list.length, 2)
    assert.equal(list[0].id, snap.id)
    assert.equal(list[0].label, 'release')

    await ctx.store.updateSnapshotLabel(snap.id, 'updated')
    assert.equal(ctx.store.listSnapshots(file.id)[0].label, 'updated')
    await ctx.store.updateSnapshotLabel(snap.id, '')
    assert.equal(ctx.store.listSnapshots(file.id)[0].label, undefined)
  })

  test('snapshots are pruned to MAX_SNAPSHOTS newest', async () => {
    const file = await ctx.store.createFile({ name: 'api.yaml', content: CONTENT })
    for (let i = 0; i < MAX_SNAPSHOTS + 10; i++) {
      await ctx.store.createSnapshot(file.id, {
        content: `${CONTENT}\n# version ${i}`,
      })
    }
    const list = ctx.store.listSnapshots(file.id)
    assert.equal(list.length, MAX_SNAPSHOTS)
    assert.ok(list[0].content.includes('# version ' + (MAX_SNAPSHOTS + 9)))
  })

  test('snapshots are fetched, updated and deleted by id', async () => {
    const file = await ctx.store.createFile({ name: 'api.yaml', content: CONTENT })
    const snap = await ctx.store.createSnapshot(file.id, { content: CONTENT })

    const byId = ctx.store.getSnapshot(snap.id)
    assert.equal(byId.id, snap.id)
    assert.equal(ctx.store.getSnapshot('nope'), null)

    await ctx.store.deleteSnapshot(snap.id)
    assert.equal(ctx.store.getSnapshot(snap.id), null)
    assert.equal(ctx.store.listSnapshots(file.id).length, 0)
  })

  test('deleting a file cascades to its snapshots', async () => {
    const file = await ctx.store.createFile({ name: 'api.yaml', content: CONTENT })
    await ctx.store.createSnapshot(file.id, { content: CONTENT })
    await ctx.store.deleteFile(file.id)
    assert.equal(ctx.store.listSnapshots(file.id).length, 0)
  })

  test('preferences round-trip', async () => {
    assert.deepEqual(ctx.store.getPreferences(), {})
    const saved = await ctx.store.setPreferences({ showPreview: false })
    assert.deepEqual(saved, { showPreview: false })
    assert.deepEqual(ctx.store.getPreferences(), { showPreview: false })
  })

  test('data persists to disk and reloads', async () => {
    const file = await ctx.store.createFile({ name: 'api.yaml', content: CONTENT })
    await ctx.store.createSnapshot(file.id, { content: CONTENT })
    await ctx.store.setPreferences({ showPreview: true })

    const reloaded = new Store(ctx.dir)
    await reloaded.load()

    assert.equal(reloaded.listFiles().length, 1)
    assert.equal(reloaded.listFiles()[0].name, 'api.yaml')
    assert.equal(reloaded.listSnapshots(file.id).length, 1)
    assert.deepEqual(reloaded.getPreferences(), { showPreview: true })
  })

  test('recovers from a corrupt database file', async () => {
    const { writeFileSync } = await import('node:fs')
    writeFileSync(join(ctx.dir, 'db.json'), '{ not valid json')

    const recovered = new Store(ctx.dir)
    await recovered.load()
    assert.equal(recovered.listFiles().length, 0)
    // The corrupt file should have been moved aside
    const { readdirSync } = await import('node:fs')
    const entries = readdirSync(ctx.dir)
    assert.ok(entries.some((e) => e.startsWith('db.json.corrupt-')))
  })
})
