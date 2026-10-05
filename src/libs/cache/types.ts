export interface CacheEntry<T> {
  data: T
  expiry: number
}

export interface CacheBackend {
  get<T>(key: string): Promise<T | null>
  // ttlMs = 0 preserves aggregate state without an expiration.
  set<T>(key: string, data: T, ttlMs: number): Promise<void>
  delete(key: string): Promise<void>
}
