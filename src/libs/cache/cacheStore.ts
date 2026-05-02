import { CacheBackend } from "./types"
import { MemoryBackend } from "./MemoryBackend"
import { FsBackend } from "./FsBackend"

class CacheStore {
  private l1: CacheBackend = new MemoryBackend()
  private l2: CacheBackend = new FsBackend()

  async getOrSet<T>(key: string, ttlMs: number, fetcher: () => Promise<T>): Promise<T> {
    const cached = await this.get<T>(key)
    if (cached !== null) {
      console.log(`✅ Cache hit: ${key}`)
      return cached
    }
    console.log(`📡 Cache miss, fetching: ${key}`)
    const data = await fetcher()
    await this.set(key, data, ttlMs)
    return data
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
