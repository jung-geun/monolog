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

const REFRESHABLE_STATUS = new Set([401, 403, 404, 410])

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

/**
 * Image proxy API to handle Notion's expiring signed URLs
 * 
 * Usage: /api/image-proxy?url=https://notion-image-url
 * 
 * This proxies Notion images through our server to:
 * 1. Bypass CORS issues
 * 2. Cache images (Next.js handles caching automatically)
 * 3. Avoid expired presigned URL issues
 */
export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  const { url } = req.query

  if (!url || typeof url !== 'string') {
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

  const metadata = parseProxyMetadata(req)
  if (metadata.blockId || metadata.pageId || metadata.property) {
    console.log('[image-proxy] metadata=', metadata)
  }

  // Heuristic: if the resolved URL looks like a partial presigned S3 URL
  // (for example it contains X-Amz-Algorithm but is missing X-Amz-Signature),
  // try to recover additional X-Amz parameters from the original raw input
  // (sometimes params are split across encoded layers). This is a best-effort
  // recovery and should only be used for diagnostics / retry; it may not
  // restore a valid signature if the input is truncated.
  try {
    if (resolvedUrl.includes('X-Amz-Algorithm') && !resolvedUrl.includes('X-Amz-Signature')) {
      const raw = String(url)
      let decodedRaw = raw
      try {
        decodedRaw = decodeURIComponent(raw)
      } catch (e) {
        // ignore decode errors and fall back to raw
      }

      // Find all X-Amz-...= tokens in the decoded raw input
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
    // swallow heuristic errors to avoid masking the original problem
    console.log('[image-proxy] heuristic step error', e && (e as Error).message)
  }

  // Validate that it's a Notion/AWS URL for security
  if (!resolvedUrl.includes('amazonaws.com') && !resolvedUrl.includes('notion')) {
    return res.status(403).json({ error: 'URL not allowed' })
  }

  const refreshDiagnostics: { attempted: boolean; success: boolean; via?: string } = {
    attempted: false,
    success: false,
  }

  try {
    // Fetch the image from Notion with retry logic
    let imageResponse: Response | undefined
    let lastError: unknown
    let currentUrl = resolvedUrl

    const maxAttempts = 3
    let attempt = 1

    while (attempt <= maxAttempts) {
      try {
        imageResponse = await fetch(currentUrl, {
          headers: {
            'User-Agent': 'Mozilla/5.0 (compatible; NotionImageProxy/1.0)',
          },
        })
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
      // Record error to disk for later inspection
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

    // Get the image buffer
    const imageBuffer = await imageResponse.arrayBuffer()
    const contentType = imageResponse.headers.get('content-type') || 'image/jpeg'

    // Set aggressive cache headers (cache for 1 year)
    res.setHeader('Content-Type', contentType)
    res.setHeader('Cache-Control', 'public, max-age=31536000, s-maxage=31536000, immutable')
    res.setHeader('CDN-Cache-Control', 'public, max-age=31536000')
    res.setHeader('Vercel-CDN-Cache-Control', 'public, max-age=31536000')
    res.setHeader('Content-Length', imageBuffer.byteLength)

    // Send the image
    res.status(200).send(Buffer.from(imageBuffer))
  } catch (error) {
    console.error('Error proxying image:', error)

    // Write a persistent record for production debugging
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
    // Try to notify admin via Slack webhook (best-effort, non-blocking)
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
          // fire-and-forget
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

    // Return a lightweight placeholder SVG instead of 500 to improve UX
    try {
      const placeholderSvg = `<?xml version="1.0" encoding="UTF-8"?><svg xmlns='http://www.w3.org/2000/svg' width='400' height='300' viewBox='0 0 400 300' role='img' aria-label='Image unavailable'><rect width='100%' height='100%' fill='#f3f4f6'/><text x='50%' y='50%' dominant-baseline='middle' text-anchor='middle' fill='#6b7280' font-family='-apple-system,BlinkMacSystemFont,Segoe UI,Roboto,Helvetica,Arial,sans-serif' font-size='18'>Image unavailable</text></svg>`
      res.setHeader('Content-Type', 'image/svg+xml')
      // Short cache to allow quick retries (10 minutes)
      res.setHeader('Cache-Control', 'public, max-age=600, s-maxage=600')
      return res.status(200).send(placeholderSvg)
    } catch (e) {
      // Final fallback: JSON 500 if sending SVG fails
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
