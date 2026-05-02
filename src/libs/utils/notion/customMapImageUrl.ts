import { Block } from 'notion-types'
import {
  createProxyRequestUrl,
  ImageProxyMetadata,
  isAlreadyProxied,
} from 'src/libs/utils/image/proxyUtils'

type CustomMapContext = Omit<ImageProxyMetadata, 'blockId' | 'pageId' | 'source'> & {
  pageId?: string
  source?: string
}

export const customMapImageUrl = (url: string, block?: Block, context?: CustomMapContext): string => {
  // 함수 호출 여부 확인 로그
  if (process.env.NODE_ENV !== 'production') {
    console.log('🔍 [customMapImageUrl] Called with URL:', url.substring(0, 100))
  }
  
  if (!url) {
    throw new Error("URL can't be empty")
  }

  if (url.startsWith('data:')) {
    return url
  }

  const alreadyProxied = isAlreadyProxied(url)
  if (process.env.NODE_ENV !== 'production') {
    console.log(`[customMapImageUrl] isAlreadyProxied(${url}) = ${alreadyProxied}`)
  }

  if (alreadyProxied) {
    return url
  }

  const metadata: ImageProxyMetadata = { ...(context ?? {}) }

  if (block) {
    metadata.blockId = block.id
    const parentId = (block as any)?.parent_id
    if (typeof parentId === 'string' && parentId.length > 0) {
      metadata.pageId = metadata.pageId ?? parentId
    }
    metadata.source = metadata.source ?? 'recordMap'
  } else if (!metadata.source && (metadata.pageId || metadata.property)) {
    metadata.source = 'pageProperty'
  }

  // more recent versions of notion don't proxy unsplash images
  if (url.startsWith('https://images.unsplash.com')) {
    return url
  }

  // Proxy Notion's signed S3 URLs through our API to avoid expiration
  // This allows Next.js to cache the images and serve them even after the signed URL expires
  if (url.startsWith('https://prod-files-secure.s3.us-west-2.amazonaws.com')) {
    if (process.env.NODE_ENV !== 'production') {
      console.log('✅ [customMapImageUrl] Proxying AWS signed S3 URL')
    }
    // Use our image proxy API to cache the image.
    // Return an absolute URL (helps avoid relative-path double-wrapping
    // when pages are rendered in different contexts).
    return createProxyRequestUrl(url, metadata)
  }
  
  // Also proxy other S3 URLs that might expire
  // Ensure we don't double-proxy if the URL is already proxied but somehow missed by isAlreadyProxied
  if (
    url.includes('amazonaws.com') && 
    url.includes('X-Amz-Signature') &&
    !url.includes('/api/image-proxy') &&
    !url.includes('%2Fapi%2Fimage-proxy')
  ) {
    if (process.env.NODE_ENV !== 'production') {
      console.log('✅ [customMapImageUrl] Proxying S3 signed URL')
    }
    return createProxyRequestUrl(url, metadata)
  }

  try {
    const u = new URL(url)

    if (
      u.pathname.startsWith('/secure.notion-static.com') &&
      u.hostname.endsWith('.amazonaws.com')
    ) {
      if (
        u.searchParams.has('X-Amz-Credential') &&
        u.searchParams.has('X-Amz-Signature') &&
        u.searchParams.has('X-Amz-Algorithm')
      ) {
        // if the URL is already signed, then use it as-is
        return url
      }
    }
    
    // If URL is already a signed S3 URL with AWS signature, use it directly
    if (
      u.hostname.endsWith('.amazonaws.com') &&
      u.searchParams.has('X-Amz-Signature')
    ) {
      return url
    }
  } catch {
    // ignore invalid urls
  }

  if (url.startsWith('/images')) {
    url = `https://www.notion.so${url}`
  }

  url = `https://www.notion.so${
    url.startsWith('/image') ? url : `/image/${encodeURIComponent(url)}`
  }`

  const notionImageUrlV2 = new URL(url)
  
  // Block parameter is optional, only use it if provided
  if (block) {
    let table = block.parent_table === 'space' ? 'block' : block.parent_table
    if (table === 'collection' || table === 'team') {
      table = 'block'
    }
    notionImageUrlV2.searchParams.set('table', table)
    notionImageUrlV2.searchParams.set('id', block.id)
  }
  notionImageUrlV2.searchParams.set('cache', 'v2')

  const finalUrl = notionImageUrlV2.toString()

  // Proxy the final Notion image URL through our image proxy so that all
  // thumbnails (main feed + detail pages) consistently go through a single
  // caching layer. Using an absolute URL when NEXT_PUBLIC_SITE_URL is set
  // avoids issues with double-wrapping in nested rendering contexts.
  return createProxyRequestUrl(finalUrl, metadata)
}
