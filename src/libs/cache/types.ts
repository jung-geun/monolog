export interface CacheEntry<T> {
  data: T
  expiry: number
}

export interface CacheBackend {
  get<T>(key: string): Promise<T | null>
  set<T>(key: string, data: T, ttlMs: number): Promise<void>
  delete(key: string): Promise<void>
  clear(prefix?: string): Promise<void>
}
