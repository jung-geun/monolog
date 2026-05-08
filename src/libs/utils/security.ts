import type { NextApiRequest } from "next"
import { LRUCache } from "lru-cache"
import { ipHash } from "src/libs/utils/comments/hash"

export function getIp(req: NextApiRequest): string {
  const hops = parseInt(process.env.TRUSTED_PROXY_HOPS ?? "0", 10)
  if (hops > 0) {
    const forwarded = req.headers["x-forwarded-for"]
    if (typeof forwarded === "string") {
      const ips = forwarded.split(",").map((s) => s.trim())
      const idx = ips.length - hops
      if (idx >= 0) return ips[idx]
    }
  }
  return req.socket?.remoteAddress ?? "unknown"
}

export function getIpHash(req: NextApiRequest): string {
  return ipHash(getIp(req))
}

const imageProxyStore = new LRUCache<string, { count: number; start: number }>({
  max: 50_000,
  ttl: 60_000,
})
const IMAGE_PROXY_PER_MIN = 120

export function checkImageProxyRateLimit(ipH: string): { ok: boolean } {
  const now = Date.now()
  const entry = imageProxyStore.get(ipH)
  if (!entry || now - entry.start >= 60_000) {
    imageProxyStore.set(ipH, { count: 1, start: now })
    return { ok: true }
  }
  if (entry.count >= IMAGE_PROXY_PER_MIN) return { ok: false }
  imageProxyStore.set(ipH, { count: entry.count + 1, start: entry.start })
  return { ok: true }
}

const refreshImageStore = new LRUCache<string, { count: number; start: number }>({
  max: 20_000,
  ttl: 60_000,
})
const REFRESH_IMAGE_PER_MIN = 60

export function checkRefreshImageRateLimit(ipH: string): { ok: boolean } {
  const now = Date.now()
  const entry = refreshImageStore.get(ipH)
  if (!entry || now - entry.start >= 60_000) {
    refreshImageStore.set(ipH, { count: 1, start: now })
    return { ok: true }
  }
  if (entry.count >= REFRESH_IMAGE_PER_MIN) return { ok: false }
  refreshImageStore.set(ipH, { count: entry.count + 1, start: entry.start })
  return { ok: true }
}
