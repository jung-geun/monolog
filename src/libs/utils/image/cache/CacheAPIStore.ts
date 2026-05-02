/**
 * Cache API 기반 이미지 Blob 저장소
 *
 * 실제 이미지 Blob 데이터를 Cache API에 저장합니다.
 */

import { CACHE_API_NAME } from "./types"

/**
 * Cache API 저장소 클래스
 */
export class CacheAPIStore {
  private cache: Cache | null = null
  private initPromise: Promise<void> | null = null

  /**
   * Cache API 초기화
   */
  async init(): Promise<void> {
    // 이미 초기화 중이면 기존 Promise 반환
    if (this.initPromise) {
      return this.initPromise
    }

    // 이미 초기화됨
    if (this.cache) {
      return
    }

    this.initPromise = this.initCache()
    try {
      await this.initPromise
    } finally {
      this.initPromise = null
    }
  }

  private async initCache(): Promise<void> {
    // 브라우저 환경 확인
    if (typeof window === "undefined" || !("caches" in window)) {
      throw new Error("Cache API not supported")
    }

    this.cache = await caches.open(CACHE_API_NAME)
  }

  /**
   * Cache가 준비되었는지 확인
   */
  private ensureCache(): Cache {
    if (!this.cache) {
      throw new Error("Cache not initialized")
    }
    return this.cache
  }

  /**
   * 이미지 Blob 저장
   *
   * @param hash - 이미지 해시 (캐시 키)
   * @param blob - 이미지 Blob
   */
  async setBlob(hash: string, blob: Blob): Promise<void> {
    await this.init()
    const cache = this.ensureCache()

    // Blob을 Response로 래핑하여 저장
    const response = new Response(blob, {
      headers: {
        "Content-Type": blob.type || "image/png",
        "Content-Length": blob.size.toString(),
      },
    })

    // 내부 URL 형식으로 저장 (실제 네트워크 요청과 구분)
    const cacheUrl = this.getCacheUrl(hash)
    await cache.put(cacheUrl, response)
  }

  /**
   * 이미지 Blob 조회
   *
   * @param hash - 이미지 해시
   * @returns Blob 또는 null
   */
  async getBlob(hash: string): Promise<Blob | null> {
    await this.init()
    const cache = this.ensureCache()

    const cacheUrl = this.getCacheUrl(hash)
    const response = await cache.match(cacheUrl)

    if (!response) {
      return null
    }

    return response.blob()
  }

  /**
   * 이미지 존재 여부 확인
   */
  async hasBlob(hash: string): Promise<boolean> {
    await this.init()
    const cache = this.ensureCache()

    const cacheUrl = this.getCacheUrl(hash)
    const response = await cache.match(cacheUrl)

    return response !== undefined
  }

  /**
   * 이미지 Blob 삭제
   */
  async deleteBlob(hash: string): Promise<boolean> {
    await this.init()
    const cache = this.ensureCache()

    const cacheUrl = this.getCacheUrl(hash)
    return cache.delete(cacheUrl)
  }

  /**
   * 모든 캐시 키 조회
   */
  async getAllKeys(): Promise<string[]> {
    await this.init()
    const cache = this.ensureCache()

    const keys = await cache.keys()
    const prefix = this.getCacheUrl("")

    return keys
      .filter((request) => request.url.startsWith(prefix))
      .map((request) => {
        // 캐시 URL에서 해시 추출
        const url = new URL(request.url)
        return url.pathname.replace("/image-cache/", "")
      })
  }

  /**
   * 전체 캐시 삭제
   */
  async clear(): Promise<void> {
    await this.init()

    // Cache API의 clear 메서드는 없으므로 개별 삭제
    const keys = await this.getAllKeys()
    const cache = this.ensureCache()

    await Promise.all(keys.map((key) => cache.delete(this.getCacheUrl(key))))
  }

  /**
   * 캐시 URL 생성
   */
  private getCacheUrl(hash: string): string {
    // 내부 캐시용 URL (실제 네트워크 요청이 아님을 나타냄)
    return `https://local-cache/image-cache/${hash}`
  }
}