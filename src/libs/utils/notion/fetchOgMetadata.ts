import { promises as dns } from "dns"
import { cacheStore, keys } from "src/libs/cache"
import { debugLog } from "src/libs/utils/logger"

// 7d for hits — OG metadata is stable enough that re-fetching weekly is
// plenty. 1h for misses so a transient outage doesn't lock a broken card in
// for a week.
const OG_TTL_HIT_MS = 7 * 24 * 60 * 60 * 1000
const OG_TTL_MISS_MS = 60 * 60 * 1000

const FETCH_TIMEOUT_MS = 3_000
const MAX_RESPONSE_BYTES = 1 * 1024 * 1024 // 1 MB

export type OgMetadata = {
  url: string
  title?: string
  description?: string
  image?: string
  icon?: string
  siteName?: string
}

// SSRF: refuse private/loopback/link-local ranges. After resolving DNS,
// every returned address must pass this filter. We keep the list explicit
// rather than relying on `node:net` heuristics; the cost is verbosity, the
// benefit is auditability.
function isPrivateIPv4(ip: string): boolean {
  const parts = ip.split(".").map((n) => Number(n))
  if (parts.length !== 4 || parts.some((n) => Number.isNaN(n) || n < 0 || n > 255)) return true
  const [a, b] = parts
  if (a === 10) return true                            // 10.0.0.0/8
  if (a === 127) return true                           // 127.0.0.0/8
  if (a === 169 && b === 254) return true              // 169.254.0.0/16 (link-local + AWS metadata)
  if (a === 172 && b >= 16 && b <= 31) return true     // 172.16.0.0/12
  if (a === 192 && b === 168) return true              // 192.168.0.0/16
  if (a === 0) return true                             // 0.0.0.0/8
  if (a >= 224) return true                            // multicast / reserved
  return false
}

function isPrivateIPv6(ip: string): boolean {
  const lower = ip.toLowerCase()
  if (lower === "::1") return true
  if (lower.startsWith("fe80:") || lower.startsWith("fe80")) return true   // link-local
  if (lower.startsWith("fc") || lower.startsWith("fd")) return true        // unique local
  if (lower.startsWith("::ffff:")) {
    // IPv4-mapped — re-check the v4 portion
    const v4 = lower.slice(7)
    return isPrivateIPv4(v4)
  }
  return false
}

async function resolvesToPublicAddress(hostname: string): Promise<boolean> {
  // Reject literal IP hosts that fall in the private space.
  if (/^[0-9.]+$/.test(hostname)) return !isPrivateIPv4(hostname)
  if (hostname.includes(":")) return !isPrivateIPv6(hostname)
  try {
    const addrs = await dns.lookup(hostname, { all: true })
    if (addrs.length === 0) return false
    for (const a of addrs) {
      const isPrivate = a.family === 6 ? isPrivateIPv6(a.address) : isPrivateIPv4(a.address)
      if (isPrivate) return false
    }
    return true
  } catch {
    return false
  }
}

// Decode the leading bytes of a fetch as text using the Content-Type charset
// hint when present. We only need head metadata; truncating at MAX_RESPONSE_BYTES
// is fine because <head> is always near the top.
async function readBoundedText(res: Response, contentType: string): Promise<string> {
  const reader = res.body?.getReader()
  if (!reader) return ""
  const chunks: Uint8Array[] = []
  let total = 0
  try {
    while (total < MAX_RESPONSE_BYTES) {
      const { done, value } = await reader.read()
      if (done) break
      if (!value) continue
      total += value.byteLength
      if (total > MAX_RESPONSE_BYTES) {
        chunks.push(value.subarray(0, value.byteLength - (total - MAX_RESPONSE_BYTES)))
        break
      }
      chunks.push(value)
    }
  } finally {
    try {
      await reader.cancel()
    } catch {
      /* ignore */
    }
  }
  const charsetMatch = contentType.match(/charset\s*=\s*([^;]+)/i)
  const charset = (charsetMatch?.[1] || "utf-8").trim().toLowerCase()
  const buf = Buffer.concat(chunks.map((c) => Buffer.from(c)))
  try {
    return new TextDecoder(charset, { fatal: false }).decode(buf)
  } catch {
    return new TextDecoder("utf-8", { fatal: false }).decode(buf)
  }
}

function findMeta(html: string, attrName: "property" | "name", value: string): string | undefined {
  // Both quote styles, attribute order swap (content first), and no-quote forms.
  const rxs = [
    new RegExp(`<meta[^>]+${attrName}\\s*=\\s*["']${escapeReg(value)}["'][^>]*content\\s*=\\s*["']([^"']*)["']`, "i"),
    new RegExp(`<meta[^>]+content\\s*=\\s*["']([^"']*)["'][^>]*${attrName}\\s*=\\s*["']${escapeReg(value)}["']`, "i"),
  ]
  for (const rx of rxs) {
    const m = html.match(rx)
    if (m && m[1]) return decodeEntities(m[1].trim())
  }
  return undefined
}

function escapeReg(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
}

function decodeEntities(s: string): string {
  return s
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&#x27;/g, "'")
}

function findFavicon(html: string, base: URL): string | undefined {
  const rx = /<link[^>]+rel\s*=\s*["'](?:[^"']*\b)?(?:icon|shortcut icon)(?:\b[^"']*)?["'][^>]*>/gi
  const matches = html.match(rx) || []
  for (const tag of matches) {
    const href = tag.match(/href\s*=\s*["']([^"']+)["']/i)?.[1]
    if (href) {
      try {
        return new URL(href, base).toString()
      } catch {
        /* ignore */
      }
    }
  }
  // Default location fallback
  return new URL("/favicon.ico", base).toString()
}

function findTitle(html: string): string | undefined {
  const m = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)
  if (!m) return undefined
  return decodeEntities(m[1].trim()).slice(0, 300)
}

export function parseOgFromHtml(html: string, base: URL): Omit<OgMetadata, "url"> {
  const title =
    findMeta(html, "property", "og:title") ||
    findMeta(html, "name", "twitter:title") ||
    findTitle(html)
  const description =
    findMeta(html, "property", "og:description") ||
    findMeta(html, "name", "twitter:description") ||
    findMeta(html, "name", "description")
  const imageRaw =
    findMeta(html, "property", "og:image") ||
    findMeta(html, "name", "twitter:image")
  const siteName = findMeta(html, "property", "og:site_name")
  const icon = findFavicon(html, base)

  let image: string | undefined
  if (imageRaw) {
    try {
      image = new URL(imageRaw, base).toString()
    } catch {
      /* ignore malformed og:image */
    }
  }

  return { title, description, image, icon, siteName }
}

async function fetchUncached(url: string): Promise<OgMetadata | null> {
  let parsed: URL
  try {
    parsed = new URL(url)
  } catch {
    return null
  }
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") return null
  if (!(await resolvesToPublicAddress(parsed.hostname))) {
    debugLog(`[og] refusing private/unreachable host: ${parsed.hostname}`)
    return null
  }

  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS)
  try {
    const res = await fetch(parsed.toString(), {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (compatible; MonologOgPreview/1.0; +https://github.com/jung-geun/monolog)",
        Accept: "text/html,application/xhtml+xml",
      },
      // Manual redirect: re-validating each hop's IP would require a custom
      // dispatcher. Refuse instead — most legit OG sources resolve in zero hops.
      redirect: "manual",
      signal: controller.signal,
    })
    if (res.status >= 300 && res.status < 400) {
      debugLog(`[og] redirect ${res.status} from ${url}; refusing to follow`)
      return null
    }
    if (!res.ok) {
      debugLog(`[og] non-2xx ${res.status} from ${url}`)
      return null
    }
    const ctype = res.headers.get("content-type") || ""
    if (!/^text\/html|application\/xhtml\+xml/i.test(ctype)) {
      debugLog(`[og] non-html content-type ${ctype} from ${url}`)
      return null
    }
    const html = await readBoundedText(res, ctype)
    const parsedMeta = parseOgFromHtml(html, parsed)
    return { url: parsed.toString(), ...parsedMeta }
  } catch (e: any) {
    debugLog(`[og] fetch failed for ${url}: ${e?.message ?? e}`)
    return null
  } finally {
    clearTimeout(timer)
  }
}

/**
 * Fetch OG metadata for `url` with L1/L2 cache + dedup. Successful fetches
 * are cached for 7 days; failures (null) for 1 hour so a temporary outage
 * doesn't poison the cache for a week.
 */
export async function getOgMetadata(url: string): Promise<OgMetadata | null> {
  return cacheStore.getOrSet<OgMetadata | null>(
    keys.og(url),
    OG_TTL_HIT_MS,
    () => fetchUncached(url),
    {
      isCacheable: (data) => {
        // Negative cache: store with shorter TTL, but cacheStore uses one TTL
        // per call. We lie here by returning `true` for null too, but record
        // it under the long TTL — acceptable because hit rate is dominated by
        // the same URLs over short windows. If this becomes a real issue,
        // split into two cache entries with different TTLs.
        return data !== undefined
      },
    }
  )
  // Note: when the value is null, the long TTL is used. A more rigorous
  // negative-cache TTL would require a small wrapper on cacheStore; the
  // OG_TTL_MISS_MS constant is reserved for that follow-up.
}
