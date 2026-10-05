import { CacheBackend, CacheEntry } from "./types"

const MAX_ENTRIES = 200

export class MemoryBackend implements CacheBackend {
  private store = new Map<string, CacheEntry<unknown>>()

  async get<T>(key: string): Promise<T | null> {
    const entry = this.store.get(key) as CacheEntry<T> | undefined
    if (!entry) return null
    if (Date.now() > entry.expiry) {
      this.store.delete(key)
      return null
    }
    return entry.data
  }

  async set<T>(key: string, data: T, ttlMs: number): Promise<void> {
    if (this.store.size >= MAX_ENTRIES) {
      const oldest = this.store.keys().next().value
      if (oldest) this.store.delete(oldest)
    }
    this.store.set(key, { data, expiry: ttlMs === 0 ? Infinity : Date.now() + ttlMs })
  }

  async delete(key: string): Promise<void> {
    this.store.delete(key)
  }
}
