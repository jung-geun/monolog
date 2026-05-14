import { CacheBackend } from "./types"
import { MemoryBackend } from "./MemoryBackend"
import { RedisBackend } from "./RedisBackend"
import { debugLog } from "src/libs/utils/logger"

class NoopBackend implements CacheBackend {
  async get<T>(_key: string): Promise<T | null> { return null }
  async set<T>(_key: string, _data: T, _ttlMs: number): Promise<void> {}
  async delete(_key: string): Promise<void> {}
  async clear(_prefix?: string): Promise<void> {}
}

function createL2Backend(): CacheBackend {
  const url = process.env.REDIS_URL
  if (!url) {
    debugLog("[cache] L2 disabled (REDIS_URL not set)")
    return new NoopBackend()
  }
  const ns = `${process.env.CACHE_NAMESPACE ?? "monolog"}:`
  return new RedisBackend(url, ns)
}

class CacheStore {
  private l1: CacheBackend = new MemoryBackend()
  private l2: CacheBackend = createL2Backend()
  // `inflight` lives in this process only. In serverless (Vercel, Lambda),
  // concurrent invocations land on different instances, so cross-instance
  // thundering-herd is NOT prevented — only within-instance dedup. Redis
  // itself is the cross-instance coordination layer; concurrent first-fill
  // writes are idempotent (last write wins, same data).
  private inflight = new Map<string, Promise<any>>()

  async getOrSet<T>(
    key: string,
    ttlMs: number,
    fetcher: () => Promise<T>,
    options?: { isCacheable?: (data: T) => boolean }
  ): Promise<T> {
    const cached = await this.get<T>(key)
    if (cached !== null) {
      debugLog(`[cache] hit: ${key}`)
      return cached
    }

    // Join an already-running fetch rather than starting a duplicate Notion request
    const existing = this.inflight.get(key)
    if (existing) {
      debugLog(`[cache] joining in-flight: ${key}`)
      return existing as Promise<T>
    }

    debugLog(`[cache] miss, fetching: ${key}`)

    const promise = (async () => {
      // Yield to the event loop so other async operations can settle before the
      // heavy Notion API call starts (reduces bursty CPU spikes in dev mode).
      await new Promise<void>((r) => setTimeout(r, 10))
      try {
        const data = await fetcher()
        if (!options?.isCacheable || options.isCacheable(data)) {
          await this.set(key, data, ttlMs)
        } else {
          debugLog(`[cache] skip (not cacheable): ${key}`)
        }
        return data
      } finally {
        this.inflight.delete(key)
      }
    })()

    this.inflight.set(key, promise)
    return promise
  }

  async get<T>(key: string): Promise<T | null> {
    const l1 = await this.l1.get<T>(key)
    if (l1 !== null) return l1
    const l2 = await this.l2.get<T>(key)
    if (l2 !== null) {
      // backfill L1
      await this.l1.set(key, l2, 60_000)
    }
    return l2
  }

  async set<T>(key: string, data: T, ttlMs: number): Promise<void> {
    await Promise.all([this.l1.set(key, data, ttlMs), this.l2.set(key, data, ttlMs)])
  }

  async invalidate(key: string): Promise<void> {
    await Promise.all([this.l1.delete(key), this.l2.delete(key)])
  }

  async clear(prefix?: string): Promise<void> {
    await Promise.all([this.l1.clear(prefix), this.l2.clear(prefix)])
  }
}

export const cacheStore = new CacheStore()
