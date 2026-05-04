import { CacheBackend } from "./types"
import { MemoryBackend } from "./MemoryBackend"
import { FsBackend } from "./FsBackend"
import { debugLog } from "src/libs/utils/logger"

class CacheStore {
  private l1: CacheBackend = new MemoryBackend()
  private l2: CacheBackend = new FsBackend()
  // Deduplicates concurrent requests for the same cache key (thundering herd prevention)
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
