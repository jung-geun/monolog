/**
 * 이미지 캐시 관련 타입 정의
 */

/** 캐시 설정 */
export interface CacheConfig {
  /** 최대 캐시 항목 수 */
  maxEntries: number
  /** 최대 캐시 용량 (바이트) */
  maxSizeBytes: number
  /** 캐시 만료 시간 (밀리초) */
  maxAgeMs: number
}

/** 캐시 메타데이터 */
export interface CacheMetadata {
  /** 이미지 해시 (고유 식별자) */
  hash: string
  /** 이미지 크기 (바이트) */
  size: number
  /** 캐시 생성 시간 */
  createdAt: number
  /** 마지막 접근 시간 */
  accessedAt: number
  /** 원본 URL (참조용) */
  originalUrl?: string
  /** Content-Type */
  contentType?: string
}

/** 캐시 조회 결과 */
export interface CacheResult {
  /** 캐시 히트 여부 */
  hit: boolean
  /** Blob URL (히트 시) */
  blobUrl?: string
  /** 원본 URL (미스 시 사용) */
  originalUrl?: string
}

/** 캐시 통계 */
export interface CacheStats {
  /** 전체 항목 수 */
  entryCount: number
  /** 전체 용량 (바이트) */
  totalSize: number
  /** 최대 항목 수 */
  maxEntries: number
  /** 최대 용량 */
  maxSizeBytes: number
}

/** 기본 캐시 설정 */
export const DEFAULT_CACHE_CONFIG: CacheConfig = {
  maxEntries: 500,
  maxSizeBytes: 100 * 1024 * 1024, // 100MB
  maxAgeMs: 30 * 24 * 60 * 60 * 1000, // 30일
}

/** IndexedDB 저장소 이름 */
export const IDB_STORE_NAME = "image-cache"

/** IndexedDB 데이터베이스 이름 */
export const IDB_DB_NAME = "morethan-log-image-cache"

/** IndexedDB 데이터베이스 버전 */
export const IDB_DB_VERSION = 1

/** Cache API 캐시 이름 */
export const CACHE_API_NAME = "image-cache-v1"