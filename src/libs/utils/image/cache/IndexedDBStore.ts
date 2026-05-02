/**
 * IndexedDB 기반 메타데이터 저장소
 *
 * 캐시 메타데이터(해시, 크기, 접근 시간 등)를 저장하고 관리합니다.
 */

import {
  CacheMetadata,
  CacheStats,
  CacheConfig,
  DEFAULT_CACHE_CONFIG,
  IDB_DB_NAME,
  IDB_DB_VERSION,
  IDB_STORE_NAME,
} from "./types"

/**
 * IndexedDB 저장소 클래스
 */
export class IndexedDBStore {
  private db: IDBDatabase | null = null
  private config: CacheConfig
  private initPromise: Promise<void> | null = null

  constructor(config: CacheConfig = DEFAULT_CACHE_CONFIG) {
    this.config = config
  }

  /**
   * IndexedDB 초기화
   */
  async init(): Promise<void> {
    // 이미 초기화 중이면 기존 Promise 반환
    if (this.initPromise) {
      return this.initPromise
    }

    // 이미 초기화됨
    if (this.db) {
      return
    }

    this.initPromise = this.initDB()
    try {
      await this.initPromise
    } finally {
      this.initPromise = null
    }
  }

  private initDB(): Promise<void> {
    return new Promise((resolve, reject) => {
      // 브라우저 환경 확인
      if (typeof window === "undefined" || !window.indexedDB) {
        reject(new Error("IndexedDB not supported"))
        return
      }

      const request = indexedDB.open(IDB_DB_NAME, IDB_DB_VERSION)

      request.onerror = () => {
        reject(new Error(`Failed to open IndexedDB: ${request.error?.message}`))
      }

      request.onsuccess = () => {
        this.db = request.result
        resolve()
      }

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result

        // 기존 저장소가 있으면 삭제
        if (db.objectStoreNames.contains(IDB_STORE_NAME)) {
          db.deleteObjectStore(IDB_STORE_NAME)
        }

        // 새 저장소 생성
        const store = db.createObjectStore(IDB_STORE_NAME, { keyPath: "hash" })
        store.createIndex("accessedAt", "accessedAt", { unique: false })
        store.createIndex("createdAt", "createdAt", { unique: false })
      }
    })
  }

  /**
   * DB가 준비되었는지 확인
   */
  private ensureDB(): IDBDatabase {
    if (!this.db) {
      throw new Error("IndexedDB not initialized")
    }
    return this.db
  }

  /**
   * 메타데이터 저장
   */
  async setMetadata(metadata: CacheMetadata): Promise<void> {
    await this.init()
    const db = this.ensureDB()

    return new Promise((resolve, reject) => {
      const transaction = db.transaction(IDB_STORE_NAME, "readwrite")
      const store = transaction.objectStore(IDB_STORE_NAME)

      const request = store.put(metadata)

      request.onsuccess = () => resolve()
      request.onerror = () => reject(new Error(`Failed to save metadata: ${request.error?.message}`))
    })
  }

  /**
   * 메타데이터 조회
   */
  async getMetadata(hash: string): Promise<CacheMetadata | null> {
    await this.init()
    const db = this.ensureDB()

    return new Promise((resolve, reject) => {
      const transaction = db.transaction(IDB_STORE_NAME, "readonly")
      const store = transaction.objectStore(IDB_STORE_NAME)
      const request = store.get(hash)

      request.onsuccess = () => resolve(request.result || null)
      request.onerror = () => reject(new Error(`Failed to get metadata: ${request.error?.message}`))
    })
  }

  /**
   * 메타데이터 삭제
   */
  async deleteMetadata(hash: string): Promise<void> {
    await this.init()
    const db = this.ensureDB()

    return new Promise((resolve, reject) => {
      const transaction = db.transaction(IDB_STORE_NAME, "readwrite")
      const store = transaction.objectStore(IDB_STORE_NAME)
      const request = store.delete(hash)

      request.onsuccess = () => resolve()
      request.onerror = () => reject(new Error(`Failed to delete metadata: ${request.error?.message}`))
    })
  }

  /**
   * 접근 시간 업데이트
   */
  async updateAccessedAt(hash: string): Promise<void> {
    const metadata = await this.getMetadata(hash)
    if (metadata) {
      metadata.accessedAt = Date.now()
      await this.setMetadata(metadata)
    }
  }

  /**
   * 모든 메타데이터 조회
   */
  async getAllMetadata(): Promise<CacheMetadata[]> {
    await this.init()
    const db = this.ensureDB()

    return new Promise((resolve, reject) => {
      const transaction = db.transaction(IDB_STORE_NAME, "readonly")
      const store = transaction.objectStore(IDB_STORE_NAME)
      const request = store.getAll()

      request.onsuccess = () => resolve(request.result || [])
      request.onerror = () => reject(new Error(`Failed to get all metadata: ${request.error?.message}`))
    })
  }

  /**
   * 캐시 통계 조회
   */
  async getStats(): Promise<CacheStats> {
    const allMetadata = await this.getAllMetadata()

    return {
      entryCount: allMetadata.length,
      totalSize: allMetadata.reduce((sum, m) => sum + m.size, 0),
      maxEntries: this.config.maxEntries,
      maxSizeBytes: this.config.maxSizeBytes,
    }
  }

  /**
   * 만료된 항목 조회
   */
  async getExpiredEntries(): Promise<CacheMetadata[]> {
    const allMetadata = await this.getAllMetadata()
    const now = Date.now()

    return allMetadata.filter((m) => now - m.createdAt > this.config.maxAgeMs)
  }

  /**
   * LRU 기반 정리 대상 항목 조회
   */
  async getLRUEntries(count: number): Promise<CacheMetadata[]> {
    const allMetadata = await this.getAllMetadata()

    // 접근 시간 기준 오름차순 정렬 (가장 오래된 것이 앞에)
    return allMetadata
      .sort((a, b) => a.accessedAt - b.accessedAt)
      .slice(0, count)
  }

  /**
   * 전체 메타데이터 삭제
   */
  async clear(): Promise<void> {
    await this.init()
    const db = this.ensureDB()

    return new Promise((resolve, reject) => {
      const transaction = db.transaction(IDB_STORE_NAME, "readwrite")
      const store = transaction.objectStore(IDB_STORE_NAME)
      const request = store.clear()

      request.onsuccess = () => resolve()
      request.onerror = () => reject(new Error(`Failed to clear metadata: ${request.error?.message}`))
    })
  }

  /**
   * IndexedDB 연결 종료
   */
  close(): void {
    if (this.db) {
      this.db.close()
      this.db = null
    }
  }
}