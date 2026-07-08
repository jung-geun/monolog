import type { NextApiRequest } from "next"
import { LRUCache } from "lru-cache"
import { ipHash } from "src/libs/utils/comments/hash"

export function getIp(req: NextApiRequest): string {
  const hops = parseInt(process.env.TRUSTED_PROXY_HOPS ?? "0", 10)
  if (hops > 0) {
    const forwarded = req.headers["x-forwarded-for"]
    if (typeof forwarded === "string") {
      const ips = forwarded.split(",").map((s) => s.trim())
      const idx = ips.length - hops - 1
      if (idx >= 0 && ips[idx]) return ips[idx]
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

function normalizeOrigin(input: string | undefined): string | null {
  if (!input || typeof input !== "string") return null

  const trimmed = input.trim()
  if (!trimmed) return null

  const withScheme = trimmed.startsWith("//")
    ? `https:${trimmed}`
    : trimmed

  try {
    return new URL(withScheme).origin.toLowerCase()
  } catch {
    // Accept host-only entries from env vars (e.g. mysite.com or mysite.com:3000)
    if (!/^[a-z][a-z0-9+.-]*:\/\//i.test(withScheme) && !trimmed.includes("/")) {
      try {
        return new URL(`https://${trimmed}`).origin.toLowerCase()
      } catch {
        return null
      }
    }
  }
  return null
}

function normalizeAllowedOrigins(origins?: Array<string | undefined> | null): Set<string> {
  const candidateOrigins = origins ?? [
    process.env.NEXT_PUBLIC_SITE_URL,
    process.env.SITE_URL,
    process.env.NEXT_PUBLIC_APP_URL,
    process.env.VERCEL_URL,
  ]
  const normalized = new Set<string>()
  for (const origin of candidateOrigins) {
    const next = normalizeOrigin(origin)
    if (next) normalized.add(next)
  }
  return normalized
}

export function extractRequestOrigin(req: NextApiRequest): string | null {
  const originHeader = req.headers["origin"]
  const refererHeader = req.headers["referer"] || req.headers["referrer"]

  const rawOrigin =
    typeof originHeader === "string" && originHeader
      ? originHeader
      : typeof refererHeader === "string"
        ? refererHeader
        : undefined

  return normalizeOrigin(rawOrigin)
}

export function isRequestOriginAllowed(req: NextApiRequest, allowedOrigins?: Array<string | undefined>): boolean {
  if (process.env.NODE_ENV !== "production") return true

  const source = extractRequestOrigin(req)
  if (!source) return false

  const allowed = normalizeAllowedOrigins(allowedOrigins)
  if (allowed.size === 0) return false

  return allowed.has(source)
}

export function normalizeNotionId(value: string): string {
  const trimmed = value.trim()
  return trimmed.replace(/-/g, "").toLowerCase()
}

export function isValidNotionId(value: string): boolean {
  const trimmed = value.trim()
  const uuidWithDashes =
    /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/
  if (uuidWithDashes.test(trimmed)) return true
  const uuidWithoutDashes = /^[0-9a-fA-F]{32}$/
  return uuidWithoutDashes.test(trimmed)
}
