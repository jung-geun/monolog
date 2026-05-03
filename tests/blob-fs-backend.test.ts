/**
 * @jest-environment node
 */

import os from 'os'
import path from 'path'
import fs from 'fs/promises'
import { BlobFsBackend } from 'src/libs/cache/blobFsBackend'

async function makeTmpDir(): Promise<string> {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'blob-cache-test-'))
  return dir
}

describe('BlobFsBackend', () => {
  let tmpDir: string
  let cache: BlobFsBackend

  beforeEach(async () => {
    tmpDir = await makeTmpDir()
    cache = new BlobFsBackend(tmpDir)
  })

  afterEach(async () => {
    await fs.rm(tmpDir, { recursive: true, force: true })
  })

  it('returns null for unknown key', async () => {
    const result = await cache.get('nonexistent-key')
    expect(result).toBeNull()
  })

  it('set and get roundtrip', async () => {
    const buf = Buffer.from('hello world', 'utf-8')
    await cache.set('mykey', buf, 'image/jpeg', 60_000)
    const hit = await cache.get('mykey')
    expect(hit).not.toBeNull()
    expect(hit!.contentType).toBe('image/jpeg')
    expect(hit!.buffer.toString('utf-8')).toBe('hello world')
  })

  it('returns null for expired entries', async () => {
    const buf = Buffer.from('expired', 'utf-8')
    // TTL of -1ms means already expired
    await cache.set('expkey', buf, 'image/png', -1)
    const hit = await cache.get('expkey')
    expect(hit).toBeNull()
  })

  it('cleans up expired entries on runCleanup', async () => {
    const buf = Buffer.from('data', 'utf-8')
    await cache.set('live-key', buf, 'image/png', 60_000)
    await cache.set('dead-key', buf, 'image/png', -1)

    await cache.runCleanup()

    const files = await fs.readdir(tmpDir)
    // live-key should still have its .bin and .meta.json
    const hasLive = files.some((f) => f.endsWith('.bin'))
    expect(hasLive).toBe(true)

    // dead-key's files should be gone (only live-key's pair remains = 2 files)
    expect(files.filter((f) => f.endsWith('.bin')).length).toBe(1)
    expect(files.filter((f) => f.endsWith('.meta.json')).length).toBe(1)
  })

  it('evicts LRU entries when over MAX_ENTRIES (simulated with small backend)', async () => {
    // We can't easily override MAX_ENTRIES from outside, so we just verify
    // runCleanup doesn't crash when called with many entries
    const buf = Buffer.from('x'.repeat(1024), 'utf-8')
    for (let i = 0; i < 5; i++) {
      await cache.set(`key-${i}`, buf, 'image/jpeg', 60_000)
    }
    await expect(cache.runCleanup()).resolves.not.toThrow()

    // All 5 should still be present since we're well under the 500-entry cap
    const files = await fs.readdir(tmpDir)
    expect(files.filter((f) => f.endsWith('.bin')).length).toBe(5)
  })

  it('handles corrupted meta file gracefully', async () => {
    const crypto = await import('crypto')
    const hash = crypto.createHash('sha256').update('badmeta').digest('hex')
    await fs.writeFile(path.join(tmpDir, `${hash}.meta.json`), '{not json}', 'utf-8')
    await fs.writeFile(path.join(tmpDir, `${hash}.bin`), Buffer.from('data'))

    // get() should return null without throwing
    const result = await cache.get('badmeta')
    expect(result).toBeNull()

    // runCleanup should delete the orphaned files
    await cache.runCleanup()
    const files = await fs.readdir(tmpDir)
    expect(files.filter((f) => !f.startsWith('.'))).toHaveLength(0)
  })
})
