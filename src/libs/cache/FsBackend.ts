import path from "path"
import { CacheBackend, CacheEntry } from "./types"

const CACHE_DIR = path.join(process.cwd(), ".notion-cache")

function isServerless(): boolean {
  return !!(process.env.VERCEL || process.env.NETLIFY || process.env.AWS_LAMBDA_FUNCTION_NAME)
}

async function getFs() {
  // fs is available on Node.js; dynamically imported to avoid bundling in client code
  const fs = await import("fs/promises")
  return fs
}

function entryPath(key: string): string {
  // Use a simple hash to turn arbitrary keys into safe filenames
  let hash = 0
  for (let i = 0; i < key.length; i++) {
    hash = (hash * 31 + key.charCodeAt(i)) >>> 0
  }
  return path.join(CACHE_DIR, `${hash.toString(16)}-${key.replace(/[^a-z0-9]/gi, "_").slice(0, 40)}.json`)
}

export class FsBackend implements CacheBackend {
  private ready: boolean | null = null

  private async ensureReady(): Promise<boolean> {
    if (this.ready !== null) return this.ready
    if (isServerless()) {
      this.ready = false
      return false
    }
    try {
      const fs = await getFs()
      await fs.mkdir(CACHE_DIR, { recursive: true })
      // Write probe
      const probe = path.join(CACHE_DIR, ".probe")
      await fs.writeFile(probe, "ok")
      await fs.unlink(probe)
      this.ready = true
    } catch {
      this.ready = false
    }
    return this.ready
  }

  async get<T>(key: string): Promise<T | null> {
    if (!(await this.ensureReady())) return null
    try {
      const fs = await getFs()
      const raw = await fs.readFile(entryPath(key), "utf-8")
      const entry = JSON.parse(raw) as CacheEntry<T>
      if (Date.now() > entry.expiry) {
        await this.delete(key)
        return null
      }
      return entry.data
    } catch {
      return null
    }
  }

  async set<T>(key: string, data: T, ttlMs: number): Promise<void> {
    if (!(await this.ensureReady())) return
    try {
      const fs = await getFs()
      const entry: CacheEntry<T> = { data, expiry: Date.now() + ttlMs }
      await fs.writeFile(entryPath(key), JSON.stringify(entry), "utf-8")
    } catch {
      // ignore write failures silently
    }
  }

  async delete(key: string): Promise<void> {
    if (!(await this.ensureReady())) return
    try {
      const fs = await getFs()
      await fs.unlink(entryPath(key))
    } catch {
      // ignore
    }
  }

  async clear(prefix?: string): Promise<void> {
    if (!(await this.ensureReady())) return
    try {
      const fs = await getFs()
      const files = await fs.readdir(CACHE_DIR)
      const safePrefix = prefix?.replace(/[^a-z0-9]/gi, "_").slice(0, 40)
      await Promise.all(
        files
          .filter((f) => f.endsWith(".json") && (!safePrefix || f.includes(safePrefix)))
          .map((f) => fs.unlink(path.join(CACHE_DIR, f)).catch(() => undefined))
      )
    } catch {
      // ignore
    }
  }
}
