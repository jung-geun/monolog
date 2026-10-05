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
    lazyConnect: false,
    maxRetriesPerRequest: 2,
    enableOfflineQueue: true,
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

  async getStrict<T>(key: string): Promise<T | null> {
    const raw = await this.redis.get(this.k(key))
    return raw === null ? null : decodeEnvelope<T>(raw)
  }

  async setStrict<T>(key: string, data: T, ttlMs: number): Promise<void> {
    const payload = encodeEnvelope(data)
    if (payload.length > SIZE_LIMIT_BYTES) throw new Error("Shared state exceeds the Redis value size limit")
    if (ttlMs === 0) await this.redis.set(this.k(key), payload)
    else await this.redis.set(this.k(key), payload, "PX", ttlMs)
  }

  async get<T>(key: string): Promise<T | null> {
    try {
      return await this.getStrict<T>(key)
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
      if (ttlMs === 0) await this.redis.set(this.k(key), payload)
      else await this.redis.set(this.k(key), payload, "PX", ttlMs)
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
}
