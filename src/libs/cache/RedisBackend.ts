import Redis from "ioredis"
import { CacheBackend } from "./types"
import { encodeEnvelope, decodeEnvelope } from "./serialization"
import { debugLog, warnLog } from "src/libs/utils/logger"

// NOTE: If you add Vercel Edge Runtime routes in the future, this TCP-based
// backend will not work there. Use an HTTP-based Redis client (e.g. Upstash)
// for Edge routes.
const SIZE_LIMIT_BYTES =
  parseInt(process.env.REDIS_VALUE_SIZE_LIMIT_KB ?? "2048") * 1024

let sharedClient: Redis | null = null

function getSharedClient(url: string): Redis {
  if (sharedClient) return sharedClient
  sharedClient = new Redis(url, {
    lazyConnect: true,
    maxRetriesPerRequest: 2,
    enableOfflineQueue: false,
  })
  sharedClient.on("error", (err: Error) =>
    debugLog(`[redis] error: ${err.message}`)
  )
  return sharedClient
}

export class RedisBackend implements CacheBackend {
  private redis: Redis
  private prefix: string

  constructor(url: string, prefix: string) {
    this.redis = getSharedClient(url)
    this.prefix = prefix
  }

  private k(key: string): string {
    return `${this.prefix}${key}`
  }

  async get<T>(key: string): Promise<T | null> {
    try {
      const raw = await this.redis.get(this.k(key))
      if (raw == null) return null
      return decodeEnvelope<T>(raw)
    } catch (err: any) {
      debugLog(`[redis] get error: ${err.message}`)
      return null
    }
  }

  async set<T>(key: string, data: T, ttlMs: number): Promise<void> {
    try {
      const payload = encodeEnvelope(data)
      if (payload.length > SIZE_LIMIT_BYTES) {
        warnLog(
          `[redis] skip oversize key: ${key} (${payload.length}B > ${SIZE_LIMIT_BYTES}B)`
        )
        return
      }
      await this.redis.set(this.k(key), payload, "PX", ttlMs)
    } catch (err: any) {
      debugLog(`[redis] set error: ${err.message}`)
    }
  }

  async delete(key: string): Promise<void> {
    try {
      await this.redis.del(this.k(key))
    } catch (err: any) {
      debugLog(`[redis] delete error: ${err.message}`)
    }
  }

  async clear(prefix?: string): Promise<void> {
    try {
      // SCAN is non-blocking unlike KEYS — safe for production Redis
      const pattern = this.k(prefix ?? "") + "*"
      let cursor = "0"
      do {
        const [next, keys] = await this.redis.scan(
          cursor,
          "MATCH",
          pattern,
          "COUNT",
          100
        )
        cursor = next
        if (keys.length > 0) {
          await this.redis.del(...keys)
        }
      } while (cursor !== "0")
    } catch (err: any) {
      debugLog(`[redis] clear error: ${err.message}`)
    }
  }
}
