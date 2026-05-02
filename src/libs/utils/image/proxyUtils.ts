const SITE_PREFIX = (() => {
  const site = process.env.NEXT_PUBLIC_SITE_URL || ''
  return site ? site.replace(/\/$/, '') : ''
})()

export const IMAGE_PROXY_PATH = '/api/image-proxy'

export type ImageProxyMetadata = {
  pageId?: string
  blockId?: string
  property?: string
  propertyType?: string
  source?: string
}

/** Normalise duplicates to prevent double-proxying. */
export function isAlreadyProxied(url: string): boolean {
  if (!url) {
    return false
  }
  if (url.includes(IMAGE_PROXY_PATH)) {
    return true
  }
  try {
    return decodeURIComponent(url).includes(IMAGE_PROXY_PATH)
  } catch {
    return false
  }
}

/** Prefix site origin when available and build the proxied URL. */
export function createProxyRequestUrl(targetUrl: string, meta?: ImageProxyMetadata): string {
  const params = new URLSearchParams()
  params.set('url', targetUrl)

  if (meta) {
    Object.entries(meta).forEach(([key, value]) => {
      if (typeof value === 'string' && value.length > 0) {
        params.set(key, value)
      }
    })
  }

  const query = params.toString()
  return `${SITE_PREFIX}${IMAGE_PROXY_PATH}?${query}`
}

/**
 * Decode nested proxy URLs until we recover an absolute http(s) URL.
 * Mirrors the defensive logic used inside the API route so tests and
 * server code stay aligned.
 */
export function unwrapProxiedUrl(input: string, debug = false): string {
  let cur = String(input)
  const maxRounds = 12

  for (let round = 0; round < maxRounds; round++) {
    if (/^https?:\/\//i.test(cur)) {
      if (debug) {
        console.log(`[image-proxy] unwrap: got absolute url at round ${round}`)
      }
      break
    }

    const plusNormalized = cur.replace(/\+/g, ' ')

    let decoded: string
    try {
      decoded = decodeURIComponent(plusNormalized)
    } catch (e) {
      if (debug) {
        console.log('[image-proxy] unwrap: decodeURIComponent failed at round', round, e && (e as Error).message)
      }
      break
    }

    const lastQuestionUrl = decoded.lastIndexOf('?url=')
    const lastAmpUrl = decoded.lastIndexOf('&url=')
    const lastUrlIndex = Math.max(lastQuestionUrl, lastAmpUrl)
      if (lastUrlIndex !== -1) {
      const candidate = decoded.substring(lastUrlIndex + 5)
      if (candidate && candidate !== cur) {
        cur = candidate
          if (debug) {
            console.log('[image-proxy] unwrap: extracted after last url= at round', round)
          }
        continue
      }
    }

    const proxyIndex = decoded.indexOf(IMAGE_PROXY_PATH)
    const firstUrlParam = decoded.indexOf('?url=')
    if (proxyIndex !== -1 && firstUrlParam !== -1) {
      const candidate = decoded.substring(firstUrlParam + 5)
      if (candidate && candidate !== cur) {
        cur = candidate
        if (debug) {
          console.log('[image-proxy] unwrap: extracted after first ?url= at round', round)
        }
        continue
      }
    }

    if (decoded !== cur) {
      cur = decoded
      if (debug) {
        console.log('[image-proxy] unwrap: decoding progressed at round', round)
      }
      continue
    }

    break
  }

  for (let i = 0; i < 6 && !/^https?:\/\//i.test(cur); i++) {
    try {
      cur = decodeURIComponent(cur)
      if (/^https?:\/\//i.test(cur)) break
    } catch {
      break
    }
  }

  return cur
}

/** Mask presigned tokens/signatures for safer logging. */
export function maskPresignedUrl(urlStr: unknown): string {
  try {
    const u = new URL(String(urlStr))
    for (const key of Array.from(u.searchParams.keys())) {
      if (/^X-Amz-/i.test(key) || /signature|token|credential/i.test(key)) {
        u.searchParams.set(key, '[redacted]')
      }
    }
    return u.toString()
  } catch {
    try {
      return String(urlStr).slice(0, 2000)
    } catch {
      return ''
    }
  }
}
