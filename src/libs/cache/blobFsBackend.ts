import path from 'path'
import crypto from 'crypto'

const MAX_SIZE_BYTES = 1 * 1024 * 1024 * 1024 // 1 GB
const MAX_ENTRIES = 500
const TRIM_RATIO = 0.8
const CLEANUP_COOLDOWN_MS = 60 * 1000

interface BlobMeta {
  contentType: string
  size: number
  createdAt: number
  accessedAt: number
  expiry: number
}

function keyToHash(key: string): string {
  return crypto.createHash('sha256').update(key).digest('hex')
}

async function getFs() {
  return import('fs/promises')
}

export class BlobFsBackend {
  private cacheDir: string
  private ready: boolean | null = null
  private lastCleanup = 0
  private cleanupScheduled = false

  constructor(cacheDir: string) {
    this.cacheDir = cacheDir
  }

  private async ensureReady(): Promise<boolean> {
    if (this.ready !== null) return this.ready
    try {
      const fs = await getFs()
      await fs.mkdir(this.cacheDir, { recursive: true })
      const probe = path.join(this.cacheDir, '.probe')
      await fs.writeFile(probe, 'ok')
      await fs.unlink(probe)
      this.ready = true
    } catch {
      this.ready = false
    }
    return this.ready!
  }

  async get(key: string): Promise<{ buffer: Buffer; contentType: string } | null> {
    if (!(await this.ensureReady())) return null
    const hash = keyToHash(key)
    const metaPath = path.join(this.cacheDir, `${hash}.meta.json`)
    const binPath = path.join(this.cacheDir, `${hash}.bin`)

    try {
      const fs = await getFs()
      const metaRaw = await fs.readFile(metaPath, 'utf-8')
      const meta: BlobMeta = JSON.parse(metaRaw)

      if (Date.now() > meta.expiry) {
        Promise.all([fs.unlink(metaPath), fs.unlink(binPath)]).catch(() => {})
        return null
      }

      const buffer = await fs.readFile(binPath)

      // Update accessedAt non-blocking
      const updated: BlobMeta = { ...meta, accessedAt: Date.now() }
      fs.writeFile(metaPath, JSON.stringify(updated), 'utf-8').catch(() => {})

      return { buffer, contentType: meta.contentType }
    } catch {
      return null
    }
  }

  async set(key: string, buffer: Buffer, contentType: string, ttlMs: number): Promise<void> {
    if (!(await this.ensureReady())) return
    const hash = keyToHash(key)
    const metaPath = path.join(this.cacheDir, `${hash}.meta.json`)
    const binPath = path.join(this.cacheDir, `${hash}.bin`)

    try {
      const fs = await getFs()
      const now = Date.now()
      const meta: BlobMeta = {
        contentType,
        size: buffer.byteLength,
        createdAt: now,
        accessedAt: now,
        expiry: now + ttlMs,
      }
      await fs.writeFile(binPath, buffer)
      await fs.writeFile(metaPath, JSON.stringify(meta), 'utf-8')
    } catch {
      // silently ignore
    }

    this.scheduleCleanup()
  }

  private scheduleCleanup(): void {
    if (this.cleanupScheduled) return
    if (Date.now() - this.lastCleanup < CLEANUP_COOLDOWN_MS) return
    this.cleanupScheduled = true
    setImmediate(() => {
      this.runCleanup()
        .catch(() => {})
        .finally(() => {
          this.cleanupScheduled = false
          this.lastCleanup = Date.now()
        })
    })
  }

  async runCleanup(): Promise<void> {
    if (!(await this.ensureReady())) return
    try {
      const fs = await getFs()
      const files = await fs.readdir(this.cacheDir)
      const metaFiles = files.filter((f) => f.endsWith('.meta.json'))

      interface EntryInfo {
        metaPath: string
        binPath: string
        meta: BlobMeta
      }

      const now = Date.now()
      const live: EntryInfo[] = []
      const expiredDeletes: Promise<unknown>[] = []

      for (const metaFile of metaFiles) {
        const hash = metaFile.slice(0, -'.meta.json'.length)
        const metaPath = path.join(this.cacheDir, metaFile)
        const binPath = path.join(this.cacheDir, `${hash}.bin`)
        try {
          const raw = await fs.readFile(metaPath, 'utf-8')
          const meta: BlobMeta = JSON.parse(raw)
          if (now > meta.expiry) {
            expiredDeletes.push(
              Promise.all([fs.unlink(metaPath).catch(() => {}), fs.unlink(binPath).catch(() => {})])
            )
          } else {
            live.push({ metaPath, binPath, meta })
          }
        } catch {
          expiredDeletes.push(
            Promise.all([fs.unlink(metaPath).catch(() => {}), fs.unlink(binPath).catch(() => {})])
          )
        }
      }

      await Promise.all(expiredDeletes)

      const totalSize = live.reduce((s, e) => s + e.meta.size, 0)
      if (live.length <= MAX_ENTRIES && totalSize <= MAX_SIZE_BYTES) return

      // LRU eviction: least recently accessed first
      live.sort((a, b) => a.meta.accessedAt - b.meta.accessedAt)

      const targetCount = Math.floor(MAX_ENTRIES * TRIM_RATIO)
      const targetSize = Math.floor(MAX_SIZE_BYTES * TRIM_RATIO)
      let count = live.length
      let size = totalSize
      const evictDeletes: Promise<unknown>[] = []

      for (const entry of live) {
        if (count <= targetCount && size <= targetSize) break
        evictDeletes.push(
          Promise.all([
            fs.unlink(entry.metaPath).catch(() => {}),
            fs.unlink(entry.binPath).catch(() => {}),
          ])
        )
        size -= entry.meta.size
        count--
      }

      await Promise.all(evictDeletes)
    } catch {
      // silently ignore cleanup failures
    }
  }
}
