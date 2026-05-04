import path from 'path'
import os from 'os'
import { BlobFsBackend } from './blobFsBackend'
import { generateImageHash } from 'src/libs/utils/image/cache/hashUtils'

const CACHE_DIR = process.env.IMAGE_CACHE_DIR
  ?? (process.env.NODE_ENV === 'production'
    ? path.join(process.cwd(), '.image-cache')
    : path.join(os.tmpdir(), 'monolog-image-cache'))

// S3 UUID-keyed images are content-addressed — 30-day TTL is safe
const TTL_S3_MS = 30 * 24 * 60 * 60 * 1000
// Block/page-keyed images may change if Notion content is edited — 7-day TTL
const TTL_FALLBACK_MS = 7 * 24 * 60 * 60 * 1000

const backend = new BlobFsBackend(CACHE_DIR)

export interface ImageCacheKeyParams {
  id?: string
  blockId?: string
  pageId?: string
  property?: string
  resolvedUrl?: string
}

export function getImageCacheKey(params: ImageCacheKeyParams): string | null {
  if (params.id) return `img_s3_${params.id}`
  if (params.resolvedUrl) return generateImageHash(params.resolvedUrl)
  if (params.blockId) return `img_block_${params.blockId}`
  if (params.pageId && params.property) return `img_prop_${params.pageId}_${params.property}`
  return null
}

export function getImageCacheTtl(params: ImageCacheKeyParams): number {
  return params.id ? TTL_S3_MS : TTL_FALLBACK_MS
}

export const imageBlobCache = {
  get: (key: string) => backend.get(key),
  set: (key: string, buffer: Buffer, contentType: string, ttlMs: number) =>
    backend.set(key, buffer, contentType, ttlMs),
}
