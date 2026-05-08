import { NextApiRequest, NextApiResponse } from 'next'
import { errorLog } from 'src/libs/utils/logger'
import {
  ImageProxyMetadata,
  maskPresignedUrl,
  unwrapProxiedUrl,
} from 'src/libs/utils/image/proxyUtils'
import {
  appendJsonLog,
  getRequestIp,
  resolveLogFile,
} from 'src/libs/utils/image/proxyServer'
import { getOfficialNotionClient } from 'src/apis/notion-client/notionClient'
import { imageBlobCache, getImageCacheTtl } from 'src/libs/cache/imageBlobCache'
import { extractS3ImageId } from 'src/libs/utils/image/cache/hashUtils'
import { getIpHash, checkImageProxyRateLimit } from 'src/libs/utils/security'

const FETCH_TIMEOUT_MS = 10_000

async function safeFetch(url: string): Promise<Response> {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS)
  try {
    const response = await fetch(url, {
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; NotionImageProxy/1.0)' },
      redirect: 'manual',
      signal: controller.signal,
    })
    if (response.status >= 300 && response.status < 400) {
      throw new Error(`Refusing to follow redirect: ${response.status}`)
    }
    return response
  } finally {
    clearTimeout(timeout)
  }
}

const REFRESHABLE_STATUS = new Set([401, 403, 404, 410])

// Signed URL in-memory LRU (50-min TTL — shorter than Notion's ~1h presigned expiry)
const signedUrlLru = new Map<string, { url: string; exp: number }>()
const SIGNED_URL_TTL_MS = 50 * 60 * 1000
const MAX_LRU_ENTRIES = 200

function getLruSignedUrl(id: string): string | null {
  const entry = signedUrlLru.get(id)
  if (entry && Date.now() < entry.exp) return entry.url
  signedUrlLru.delete(id)
  return null
}

function setLruSignedUrl(id: string, url: string): void {
  signedUrlLru.set(id, { url, exp: Date.now() + SIGNED_URL_TTL_MS })
  if (signedUrlLru.size > MAX_LRU_ENTRIES) {
    signedUrlLru.delete(signedUrlLru.keys().next().value!)
  }
}

// In-flight dedup: collapses concurrent cold-miss requests for the same cache key
const inFlightMap = new Map<string, Promise<{ buffer: Buffer; contentType: string } | null>>()

const firstQueryValue = (value: string | string[] | undefined): string | undefined => {
  if (Array.isArray(value)) {
    return value.find((v) => typeof v === 'string' && v.length > 0)
  }
  return typeof value === 'string' && value.length > 0 ? value : undefined
}

const parseProxyMetadata = (req: NextApiRequest): ImageProxyMetadata => {
  return {
    pageId: firstQueryValue(req.query.pageId as string | string[] | undefined),
    blockId: firstQueryValue(req.query.blockId as string | string[] | undefined),
    property: firstQueryValue(req.query.property as string | string[] | undefined),
    propertyType: firstQueryValue(req.query.propertyType as string | string[] | undefined),
    source: firstQueryValue(req.query.source as string | string[] | undefined),
  }
}

const shouldAttemptRefresh = (status?: number, metadata?: ImageProxyMetadata) => {
  if (!metadata) return false
  if (!metadata.blockId && !metadata.pageId) return false
  if (!status) return true
  return REFRESHABLE_STATUS.has(status)
}

const extractUrlFromFileValue = (value: any): string | null => {
  if (!value) return null
  if (value.type === 'file') {
    return value.file?.url ?? null
  }
  if (value.type === 'external') {
    return value.external?.url ?? null
  }
  return null
}

const extractUrlFromBlock = (block: any): string | null => {
  if (!block || typeof block !== 'object') return null
  const type = block.type
  if (!type) return null
  const typeValue = (block as any)[type]
  if (!typeValue) return null
  return extractUrlFromFileValue(typeValue)
}

const extractUrlFromProperty = (property: any, declaredType?: string): string | null => {
  if (!property || typeof property !== 'object') return null
  const propType = declaredType || property.type

  if (propType === 'files' || propType === 'file') {
    const files: any[] | undefined = property.files
    if (Array.isArray(files) && files.length > 0) {
      return extractUrlFromFileValue(files[0])
    }
  }

  if (propType === 'url' && typeof property.url === 'string') {
    return property.url
  }

  return null
}

const extractUrlFromCover = (cover: any): string | null => {
  if (!cover) return null
  return extractUrlFromFileValue(cover)
}

const refreshImageUrlFromNotion = async (metadata: ImageProxyMetadata) => {
  if (!metadata.blockId && !metadata.pageId) {
    return { url: null, via: undefined as string | undefined }
  }

  try {
    const notion = getOfficialNotionClient()

    if (metadata.blockId) {
      try {
        const block = await notion.blocks.retrieve({ block_id: metadata.blockId })
        const refreshed = extractUrlFromBlock(block)
        if (refreshed) {
          return { url: refreshed, via: 'block' }
        }
      } catch (err) {
        console.log('[image-proxy] refresh via block failed', metadata.blockId, err instanceof Error ? err.message : err)
      }
    }

    if (metadata.pageId) {
      try {
        const page = await notion.pages.retrieve({ page_id: metadata.pageId })
        if (metadata.property) {
          const property = (page as any)?.properties?.[metadata.property]
          const refreshed = extractUrlFromProperty(property, metadata.propertyType)
          if (refreshed) {
            return { url: refreshed, via: 'page-property' }
          }
        }

        const coverUrl = extractUrlFromCover((page as any)?.cover)
        if (coverUrl) {
          return { url: coverUrl, via: 'page-cover' }
        }
      } catch (err) {
        console.log('[image-proxy] refresh via page failed', metadata.pageId, err instanceof Error ? err.message : err)
      }
    }
  } catch (err) {
    console.log('[image-proxy] refresh initialization failed', err instanceof Error ? err.message : err)
  }

  return { url: null, via: undefined as string | undefined }
}

const ALLOWED_HOSTS = [
  /\.amazonaws\.com$/i,
  /^amazonaws\.com$/i,
  /\.notion\.so$/i,
  /^notion\.so$/i,
  /\.notion\.com$/i,
  /^notion\.com$/i,
  /\.notion-static\.com$/i,
]

const PLACEHOLDER_SVG = `<?xml version="1.0" encoding="UTF-8"?><svg xmlns='http://www.w3.org/2000/svg' width='400' height='300' viewBox='0 0 400 300' role='img' aria-label='Image unavailable'><rect width='100%' height='100%' fill='#f3f4f6'/><text x='50%' y='50%' dominant-baseline='middle' text-anchor='middle' fill='#6b7280' font-family='-apple-system,BlinkMacSystemFont,Segoe UI,Roboto,Helvetica,Arial,sans-serif' font-size='18'>Image unavailable</text></svg>`

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (!checkImageProxyRateLimit(getIpHash(req)).ok) {
    res.setHeader('Content-Type', 'image/svg+xml')
    res.setHeader('Cache-Control', 'public, max-age=60, s-maxage=60')
    return res.status(429).send(PLACEHOLDER_SVG)
  }

  const kind = firstQueryValue(req.query.kind as string | string[] | undefined)
  const id = firstQueryValue(req.query.id as string | string[] | undefined)
  const metadata = parseProxyMetadata(req)

  // ── kind=s3: stable UUID-keyed path with BLOB disk cache ─────────────────
  if (kind === 's3' && id) {
    const cacheKey = `img_s3_${id}`

    // In-flight dedup: wait for an identical concurrent cold-miss rather than
    // making a second Notion API call for the same image.
    const existing = inFlightMap.get(cacheKey)
    if (existing) {
      const result = await existing
      if (result) {
        res.setHeader('Content-Type', result.contentType)
        res.setHeader('Cache-Control', 'public, max-age=31536000, s-maxage=31536000, immutable')
        res.setHeader('CDN-Cache-Control', 'public, max-age=31536000')
        res.setHeader('Content-Length', result.buffer.byteLength)
        return res.status(200).send(result.buffer)
      }
    }

    // Register in-flight before any async work to collapse concurrent cold-misses.
    let resolveInFlight!: (v: { buffer: Buffer; contentType: string } | null) => void
    const inFlightPromise = new Promise<{ buffer: Buffer; contentType: string } | null>((r) => {
      resolveInFlight = r
    })
    inFlightMap.set(cacheKey, inFlightPromise)

    // BLOB disk cache check (HIT → resolve in-flight + respond without network call)
    try {
      const cached = await imageBlobCache.get(cacheKey)
      if (cached) {
        resolveInFlight(cached)
        inFlightMap.delete(cacheKey)
        res.setHeader('Content-Type', cached.contentType)
        res.setHeader('Cache-Control', 'public, max-age=31536000, s-maxage=31536000, immutable')
        res.setHeader('CDN-Cache-Control', 'public, max-age=31536000')
        res.setHeader('Content-Length', cached.buffer.byteLength)
        return res.status(200).send(cached.buffer)
      }
    } catch {
      // non-fatal cache read failure — continue to origin
    }

    try {
      // Resolve a fresh presigned URL: in-memory LRU → Notion API
      let signedUrl = getLruSignedUrl(id)
      if (!signedUrl) {
        const refreshed = await refreshImageUrlFromNotion(metadata)
        if (!refreshed.url) {
          resolveInFlight(null)
          inFlightMap.delete(cacheKey)
          res.setHeader('Content-Type', 'image/svg+xml')
          res.setHeader('Cache-Control', 'public, max-age=60, s-maxage=60')
          return res.status(200).send(PLACEHOLDER_SVG)
        }
        signedUrl = refreshed.url
        setLruSignedUrl(id, signedUrl)
      }

      // SSRF allow-list
      let parsedSignedUrl: URL
      try {
        parsedSignedUrl = new URL(signedUrl)
      } catch {
        resolveInFlight(null)
        inFlightMap.delete(cacheKey)
        return res.status(400).json({ error: 'Invalid URL' })
      }
      if (parsedSignedUrl.protocol !== 'https:' && parsedSignedUrl.protocol !== 'http:') {
        resolveInFlight(null)
        inFlightMap.delete(cacheKey)
        return res.status(403).json({ error: 'Protocol not allowed' })
      }
      if (!ALLOWED_HOSTS.some((re) => re.test(parsedSignedUrl.hostname))) {
        resolveInFlight(null)
        inFlightMap.delete(cacheKey)
        return res.status(403).json({ error: 'Host not allowed' })
      }

      // Fetch with retry; on 4xx refresh the signed URL once from Notion API
      let imageResponse: Response | undefined
      let lastError: unknown
      const maxAttempts = 3

      for (let attempt = 1; attempt <= maxAttempts; attempt++) {
        try {
          imageResponse = await safeFetch(signedUrl)
        } catch (err) {
          lastError = err
          imageResponse = undefined
        }

        if (imageResponse?.ok) break

        const status = imageResponse?.status
        if (status && REFRESHABLE_STATUS.has(status)) {
          signedUrlLru.delete(id)
          const refreshed = await refreshImageUrlFromNotion(metadata)
          if (refreshed.url && refreshed.url !== signedUrl) {
            signedUrl = refreshed.url
            setLruSignedUrl(id, signedUrl)
            lastError = undefined
            continue
          }
        }

        if (imageResponse && !imageResponse.ok) {
          lastError = new Error(`HTTP ${imageResponse.status}`)
        }
        if (attempt < maxAttempts) {
          await new Promise((r) => setTimeout(r, Math.pow(2, attempt) * 100))
        }
      }

      if (!imageResponse?.ok) {
        const err = lastError || new Error('Failed to fetch image')
        resolveInFlight(null)
        inFlightMap.delete(cacheKey)
        throw err
      }

      const arrayBuf = await imageResponse.arrayBuffer()
      const buffer = Buffer.from(arrayBuf)
      const contentType = imageResponse.headers.get('content-type') || 'image/jpeg'

      // Persist to BLOB disk cache (non-blocking — client gets response immediately)
      imageBlobCache
        .set(cacheKey, buffer, contentType, getImageCacheTtl({ id }))
        .catch(() => {})

      resolveInFlight({ buffer, contentType })
      inFlightMap.delete(cacheKey)

      res.setHeader('Content-Type', contentType)
      res.setHeader('Cache-Control', 'public, max-age=31536000, s-maxage=31536000, immutable')
      res.setHeader('CDN-Cache-Control', 'public, max-age=31536000')
      res.setHeader('Content-Length', buffer.byteLength)
      return res.status(200).send(buffer)
    } catch (error) {
      resolveInFlight(null)
      inFlightMap.delete(cacheKey)
      console.error('[image-proxy] kind=s3 failed:', error)
      try {
        const slackWebhook = process.env.SLACK_WEBHOOK
        if (slackWebhook) {
          const metaParts: string[] = []
          if (metadata.pageId) metaParts.push(`pageId=${metadata.pageId}`)
          if (metadata.blockId) metaParts.push(`blockId=${metadata.blockId}`)
          fetch(slackWebhook, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              text: `:warning: image-proxy (kind=s3) failed\n• id: ${id}\n• ${metaParts.join(', ')}\n• message: ${error instanceof Error ? error.message : String(error)}`,
            }),
          }).catch(() => {})
        }
      } catch { /* non-fatal */ }
      res.setHeader('Content-Type', 'image/svg+xml')
      res.setHeader('Cache-Control', 'public, max-age=600, s-maxage=600')
      return res.status(200).send(PLACEHOLDER_SVG)
    }
  }

  // ── Legacy url= path (non-S3 CDN URLs; also handles old ISR cache entries) ─
  const url = firstQueryValue(req.query.url as string | string[] | undefined)

  if (!url) {
    return res.status(400).json({ error: 'Missing or invalid URL parameter' })
  }

  const finalUrl = unwrapProxiedUrl(url, true)
  console.log('[image-proxy] received url=', url)
  console.log('[image-proxy] finalUrl=', finalUrl)

  // Fallback: if unwrapping didn't produce an absolute URL, try to find an
  // embedded https substring (possibly percent-encoded) and decode from there.
  let resolvedUrl = finalUrl
  if (!/^https?:\/\//i.test(resolvedUrl)) {
    const idx = url.toString().search(/https?:/i)
    if (idx !== -1) {
      let candidate = url.toString().substring(idx)
      for (let i = 0; i < 6 && !/^https?:\/\//i.test(candidate); i++) {
        try {
          candidate = decodeURIComponent(candidate)
        } catch (e) {
          break
        }
      }
      if (/^https?:\/\//i.test(candidate)) {
        resolvedUrl = candidate
      }
    }
  }

  console.log('[image-proxy] resolvedUrl=', resolvedUrl)

  if (metadata.blockId || metadata.pageId || metadata.property) {
    console.log('[image-proxy] metadata=', metadata)
  }

  // Heuristic: recover missing X-Amz params from a partially-encoded raw input
  try {
    if (resolvedUrl.includes('X-Amz-Algorithm') && !resolvedUrl.includes('X-Amz-Signature')) {
      const raw = String(url)
      let decodedRaw = raw
      try {
        decodedRaw = decodeURIComponent(raw)
      } catch (e) {
        // ignore decode errors and fall back to raw
      }

      const amzMatches = decodedRaw.match(/(X-Amz-[A-Za-z0-9_-]+=[^&\s]+)/g)
      if (amzMatches && amzMatches.length) {
        try {
          const u = new URL(resolvedUrl)
          const existing = new Set(Array.from(u.searchParams.keys()))

          for (const token of amzMatches) {
            const [k, ...rest] = token.split('=')
            const v = rest.join('=')
            if (!existing.has(k)) {
              u.searchParams.append(k, v)
            }
          }

          const merged = u.toString()
          console.log('[image-proxy] heuristic: merged additional X-Amz params into resolvedUrl')
          resolvedUrl = merged
        } catch (e) {
          console.log('[image-proxy] heuristic merge failed', e && (e as Error).message)
        }
      }
    }
  } catch (e) {
    console.log('[image-proxy] heuristic step error', e && (e as Error).message)
  }

  let parsedUrl: URL
  try {
    parsedUrl = new URL(resolvedUrl)
  } catch {
    return res.status(400).json({ error: 'Invalid URL' })
  }
  if (parsedUrl.protocol !== 'https:' && parsedUrl.protocol !== 'http:') {
    return res.status(403).json({ error: 'Protocol not allowed' })
  }
  if (!ALLOWED_HOSTS.some((re) => re.test(parsedUrl.hostname))) {
    return res.status(403).json({ error: 'Host not allowed' })
  }

  // BLOB cache check for legacy url= requests that contain a stable S3 UUID
  const legacyS3Id = extractS3ImageId(resolvedUrl)
  const legacyCacheKey = legacyS3Id ? `img_s3_${legacyS3Id}` : null
  if (legacyCacheKey) {
    try {
      const cached = await imageBlobCache.get(legacyCacheKey)
      if (cached) {
        res.setHeader('Content-Type', cached.contentType)
        res.setHeader('Cache-Control', 'public, max-age=31536000, s-maxage=31536000, immutable')
        res.setHeader('CDN-Cache-Control', 'public, max-age=31536000')
        res.setHeader('Content-Length', cached.buffer.byteLength)
        return res.status(200).send(cached.buffer)
      }
    } catch {
      // non-fatal
    }
  }

  const refreshDiagnostics: { attempted: boolean; success: boolean; via?: string } = {
    attempted: false,
    success: false,
  }

  try {
    let imageResponse: Response | undefined
    let lastError: unknown
    let currentUrl = resolvedUrl

    const maxAttempts = 3
    let attempt = 1

    while (attempt <= maxAttempts) {
      try {
        imageResponse = await safeFetch(currentUrl)
      } catch (err) {
        lastError = err
        imageResponse = undefined
      }

      if (imageResponse && imageResponse.ok) {
        resolvedUrl = currentUrl
        break
      }

      const status = imageResponse?.status
      if (!refreshDiagnostics.attempted && shouldAttemptRefresh(status, metadata)) {
        refreshDiagnostics.attempted = true
        const refreshed = await refreshImageUrlFromNotion(metadata)
        if (refreshed.url && refreshed.url !== currentUrl) {
          refreshDiagnostics.success = true
          refreshDiagnostics.via = refreshed.via
          currentUrl = refreshed.url
          resolvedUrl = refreshed.url
          lastError = undefined
          console.log('[image-proxy] refreshed image URL from Notion', {
            via: refreshed.via,
            blockId: metadata.blockId,
            pageId: metadata.pageId,
            property: metadata.property,
          })
          continue
        }
      }

      if (imageResponse && !imageResponse.ok) {
        lastError = new Error(`HTTP ${imageResponse.status}`)
      }

      if (attempt >= maxAttempts) {
        break
      }

      await new Promise((resolve) => setTimeout(resolve, Math.pow(2, attempt) * 100))
      attempt += 1
    }

    if (!imageResponse || !imageResponse.ok) {
      const err = lastError || new Error('Failed to fetch image')
      try {
        const logFile = resolveLogFile('image-proxy-errors.jsonl')
        const record = {
          timestamp: new Date().toISOString(),
          ip: getRequestIp(req),
          receivedUrl: String(url).slice(0, 2000),
          rawRequestUrl: String(req.url).slice(0, 2000),
          finalUrl: finalUrl?.slice ? finalUrl.slice(0, 2000) : finalUrl,
          resolvedUrl: resolvedUrl?.slice ? resolvedUrl.slice(0, 2000) : resolvedUrl,
          maskedResolvedUrl: maskPresignedUrl(resolvedUrl),
          status: imageResponse ? imageResponse.status : null,
          message: err instanceof Error ? err.message : String(err),
          userAgent: req.headers['user-agent'],
          metadata,
          refresh: refreshDiagnostics,
        }
        appendJsonLog(logFile, record)
      } catch (fsErr) {
        errorLog('[image-proxy] failed to write error log', fsErr)
      }

      throw err
    }

    const imageBuffer = await imageResponse.arrayBuffer()
    const buffer = Buffer.from(imageBuffer)
    const contentType = imageResponse.headers.get('content-type') || 'image/jpeg'

    // Populate BLOB cache for any legacy url= requests that contain an S3 UUID
    // so subsequent kind=s3 requests immediately get a cache HIT.
    if (legacyCacheKey) {
      imageBlobCache.set(legacyCacheKey, buffer, contentType, getImageCacheTtl({ id: legacyS3Id ?? undefined })).catch(() => {})
    }

    res.setHeader('Content-Type', contentType)
    res.setHeader('Cache-Control', 'public, max-age=31536000, s-maxage=31536000, immutable')
    res.setHeader('CDN-Cache-Control', 'public, max-age=31536000')
    res.setHeader('Content-Length', buffer.byteLength)
    res.status(200).send(buffer)
  } catch (error) {
    console.error('Error proxying image:', error)

    try {
      const logFile = resolveLogFile('image-proxy-errors.jsonl')
      const record = {
        timestamp: new Date().toISOString(),
        ip: getRequestIp(req),
        receivedUrl: String(url).slice(0, 2000),
        rawRequestUrl: String(req.url).slice(0, 2000),
        finalUrl: finalUrl?.slice ? finalUrl.slice(0, 2000) : finalUrl,
        resolvedUrl: resolvedUrl?.slice ? resolvedUrl.slice(0, 2000) : resolvedUrl,
        maskedResolvedUrl: maskPresignedUrl(resolvedUrl),
        message: error instanceof Error ? error.message : String(error),
        stack: error && (error as any).stack ? String((error as any).stack).slice(0, 2000) : undefined,
        userAgent: req.headers['user-agent'],
        metadata,
        refresh: refreshDiagnostics,
      }
      appendJsonLog(logFile, record)
    } catch (fsErr) {
      errorLog('[image-proxy] failed to write error log', fsErr)
    }
    try {
      const slackWebhook = process.env.SLACK_WEBHOOK
      if (slackWebhook) {
        try {
          const rawRequestUrl = String(req.url).slice(0, 2000)
          const maskedResolved = maskPresignedUrl(resolvedUrl)
          const metaParts: string[] = []
          if (metadata.blockId) metaParts.push(`blockId=${metadata.blockId}`)
          if (metadata.pageId) metaParts.push(`pageId=${metadata.pageId}`)
          if (metadata.property) metaParts.push(`property=${metadata.property}`)
          const metaLine = metaParts.length ? `\n• meta: ${metaParts.join(', ')}` : ''
          const refreshLine = refreshDiagnostics.attempted
            ? `\n• refresh: ${refreshDiagnostics.success ? `success via ${refreshDiagnostics.via}` : 'attempted but failed'}`
            : ''
          const slackBody = {
            text: `:warning: image-proxy failed\n• requested: ${rawRequestUrl}\n• resolved: ${maskedResolved}\n• message: ${error instanceof Error ? error.message : String(error)}${metaLine}${refreshLine}`
          }
          fetch(slackWebhook, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(slackBody),
          }).catch((e) => console.log('[image-proxy] slack notify failed', e && (e as Error).message))
        } catch (e) {
          console.log('[image-proxy] slack notify error', e && (e as Error).message)
        }
      }
    } catch (e) {
      console.log('[image-proxy] slack notify outer error', e && (e as Error).message)
    }

    try {
      res.setHeader('Content-Type', 'image/svg+xml')
      res.setHeader('Cache-Control', 'public, max-age=600, s-maxage=600')
      return res.status(200).send(PLACEHOLDER_SVG)
    } catch (e) {
      return res.status(500).json({ error: 'Failed to proxy image', details: error instanceof Error ? error.message : 'Unknown error' })
    }
  }
}

// Disable body parser for this API route (we're handling binary data)
export const config = {
  api: {
    bodyParser: false,
    responseLimit: '10mb',
  },
}
