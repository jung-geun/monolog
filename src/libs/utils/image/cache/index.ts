/**
 * 이미지 캐시 매니저
 *
 * Cache API와 IndexedDB를 하이브리드 방식으로 사용하여
 * 이미지 Blob과 메타데이터를 효율적으로 관리합니다.
 */

import { CacheConfig, CacheMetadata, CacheStats, DEFAULT_CACHE_CONFIG } from "./types"
import { generateImageHash, isCacheableUrl } from "./hashUtils"
import { IndexedDBStore } from "./IndexedDBStore"
import { CacheAPIStore } from "./CacheAPIStore"

/**
 * 이미지 캐시 매니저 클래스
 */
export class ImageCacheManager {
  private idbStore: IndexedDBStore
  private cacheStore: CacheAPIStore
  private config: CacheConfig
  private isSupported: boolean | null = null
  private supportCheckPromise: Promise<boolean> | null = null

  constructor(config: CacheConfig = DEFAULT_CACHE_CONFIG) {
    this.config = config
    this.idbStore = new IndexedDBStore(config)
    this.cacheStore = new CacheAPIStore()
  }

  /**
   * 캐시 지원 여부 확인
   */
  private async checkSupport(): Promise<boolean> {
    // 이미 확인 중이면 기존 Promise 반환
    if (this.supportCheckPromise) {
      return this.supportCheckPromise
    }

    // 이미 확인됨
    if (this.isSupported !== null) {
      return this.isSupported
    }

    this.supportCheckPromise = this.doCheckSupport()
    try {
      return await this.supportCheckPromise
    } finally {
      this.supportCheckPromise = null
    }
  }

  private async doCheckSupport(): Promise<boolean> {
    // 서버 사이드 렌더링 환경
    if (typeof window === "undefined") {
      this.isSupported = false
      return false
    }

    // IndexedDB 지원 확인
    if (!window.indexedDB) {
      this.isSupported = false
      return false
    }

    // Cache API 지원 확인
    if (!("caches" in window)) {
      this.isSupported = false
      return false
    }

    // 실제 초기화 테스트
    try {
      await this.idbStore.init()
      await this.cacheStore.init()
      this.isSupported = true
      return true
    } catch {
      this.isSupported = false
      return false
    }
  }

  /**
   * 캐시에서 이미지 조회
   *
   * @param url - 원본 이미지 URL
   * @returns Blob URL (캐시 히트 시) 또는 null
   */
  async get(url: string): Promise<string | null> {
    try {
      const supported = await this.checkSupport()
      if (!supported) {
        return null
      }

      if (!isCacheableUrl(url)) {
        return null
      }

      const hash = generateImageHash(url)

      // 메타데이터 확인
      const metadata = await this.idbStore.getMetadata(hash)
      if (!metadata) {
        return null
      }

      // 만료 확인
      if (Date.now() - metadata.createdAt > this.config.maxAgeMs) {
        await this.delete(hash)
        return null
      }

      // Blob 조회
      const blob = await this.cacheStore.getBlob(hash)
      if (!blob) {
        // 메타데이터만 있고 Blob이 없는 경우 정리
        await this.idbStore.deleteMetadata(hash)
        return null
      }

      // 접근 시간 업데이트 (비동기로 실행)
      this.idbStore.updateAccessedAt(hash).catch(() => {
        // 무시
      })

      // Blob URL 생성
      return URL.createObjectURL(blob)
    } catch {
      return null
    }
  }

  /**
   * 캐시에 이미지 저장
   *
   * @param url - 원본 이미지 URL
   * @param blob - 이미지 Blob
   */
  async set(url: string, blob: Blob): Promise<void> {
    try {
      const supported = await this.checkSupport()
      if (!supported) {
        return
      }

      if (!isCacheableUrl(url)) {
        return
      }

      const hash = generateImageHash(url)
      const now = Date.now()

      // 메타데이터 생성
      const metadata: CacheMetadata = {
        hash,
        size: blob.size,
        createdAt: now,
        accessedAt: now,
        originalUrl: url,
        contentType: blob.type,
      }

      // 저장 (병렬 실행)
      await Promise.all([this.idbStore.setMetadata(metadata), this.cacheStore.setBlob(hash, blob)])

      // 캐시 정리 (비동기로 실행)
      this.cleanup().catch(() => {
        // 무시
      })
    } catch {
      // 저장 실패 시 무시
    }
  }

  /**
   * 캐시 존재 여부 확인
   */
  async has(url: string): Promise<boolean> {
    try {
      const supported = await this.checkSupport()
      if (!supported) {
        return false
      }

      if (!isCacheableUrl(url)) {
        return false
      }

      const hash = generateImageHash(url)
      const metadata = await this.idbStore.getMetadata(hash)

      if (!metadata) {
        return false
      }

      // 만료 확인
      if (Date.now() - metadata.createdAt > this.config.maxAgeMs) {
        return false
      }

      return this.cacheStore.hasBlob(hash)
    } catch {
      return false
    }
  }

  /**
   * 특정 항목 삭제
   */
  async delete(hash: string): Promise<void> {
    try {
      await Promise.all([this.idbStore.deleteMetadata(hash), this.cacheStore.deleteBlob(hash)])
    } catch {
      // 무시
    }
  }

  /**
   * 캐시 전체 삭제
   */
  async clear(): Promise<void> {
    try {
      const supported = await this.checkSupport()
      if (!supported) {
        return
      }

      await Promise.all([this.idbStore.clear(), this.cacheStore.clear()])
    } catch {
      // 무시
    }
  }

  /**
   * 캐시 통계 조회
   */
  async getStats(): Promise<CacheStats | null> {
    try {
      const supported = await this.checkSupport()
      if (!supported) {
        return null
      }

      return this.idbStore.getStats()
    } catch {
      return null
    }
  }

  /**
   * 만료 및 용량 초과 항목 정리
   */
  async cleanup(): Promise<void> {
    try {
      const supported = await this.checkSupport()
      if (!supported) {
        return
      }

      const stats = await this.idbStore.getStats()
      const deleteList: string[] = []

      // 1. 만료된 항목 삭제
      const expired = await this.idbStore.getExpiredEntries()
      deleteList.push(...expired.map((m) => m.hash))

      // 2. 항목 수 초과 시 LRU 삭제
      if (stats.entryCount > this.config.maxEntries) {
        const excessCount = stats.entryCount - this.config.maxEntries + deleteList.length
        if (excessCount > 0) {
          const lruEntries = await this.idbStore.getLRUEntries(excessCount)
          deleteList.push(...lruEntries.map((m) => m.hash))
        }
      }

      // 3. 용량 초과 시 LRU 삭제 (80%까지 정리)
      if (stats.totalSize > this.config.maxSizeBytes) {
        const targetSize = this.config.maxSizeBytes * 0.8
        const needToFree = stats.totalSize - targetSize

        if (needToFree > 0) {
          const allMetadata = await this.idbStore.getStats().then((s) =>
            this.idbStore.getAllMetadata()
          )

          // 접근 시간 기준 오름차순 정렬
          const sorted = allMetadata
            .filter((m) => !deleteList.includes(m.hash))
            .sort((a, b) => a.accessedAt - b.accessedAt)

          let freedSize = 0
          for (const m of sorted) {
            if (freedSize >= needToFree) break
            deleteList.push(m.hash)
            freedSize += m.size
          }
        }
      }

      // 중복 제거 후 삭제
      const uniqueHashes = [...new Set(deleteList)]
      await Promise.all(uniqueHashes.map((hash) => this.delete(hash)))
    } catch {
      // 무시
    }
  }

  /**
   * 리소스 정리
   */
  destroy(): void {
    this.idbStore.close()
  }
}

// 싱글톤 인스턴스
export const imageCache = new ImageCacheManager()

// 타입 재export
export * from "./types"
export { generateImageHash, isCacheableUrl } from "./hashUtils"