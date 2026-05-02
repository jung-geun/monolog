/**
 * 이미지 URL 해시 생성 유틸리티
 *
 * Notion S3 presigned URL에서 고유 식별자를 추출하여
 * 쿼리 파라미터 변화에 무관하게 동일 이미지를 식별합니다.
 */

/**
 * S3 URL에서 이미지 고유 ID를 추출합니다.
 *
 * Notion S3 URL 형식:
 * https://prod-files-secure.s3.us-west-2.amazonaws.com/{bucket}/{uuid}?X-Amz-Signature=...
 *
 * @param url - 원본 이미지 URL
 * @returns 이미지 해시 또는 null (추출 실패 시)
 */
export function extractS3ImageId(url: string): string | null {
  try {
    // Notion S3 URL 패턴 매칭
    const s3Pattern = /prod-files-secure\.s3[^\/]*\/[^\/]+\/([a-f0-9-]{36})/i
    const match = url.match(s3Pattern)

    if (match && match[1]) {
      return match[1]
    }

    return null
  } catch {
    return null
  }
}

/**
 * 간단한 문자열 해시 함수
 * (S3 URL이 아닌 경우 폴백으로 사용)
 */
function simpleHash(str: string): string {
  let hash = 0
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i)
    hash = (hash << 5) - hash + char
    hash = hash & hash // 32비트 정수로 변환
  }
  return Math.abs(hash).toString(36)
}

/**
 * 이미지 URL로부터 캐시 키를 생성합니다.
 *
 * @param url - 이미지 URL
 * @returns 캐시 키 (img_ 접두사 포함)
 */
export function generateImageHash(url: string): string {
  // S3 URL에서 UUID 추출 시도
  const s3Id = extractS3ImageId(url)
  if (s3Id) {
    return `img_${s3Id}`
  }

  // 폴백: URL 경로 기반 해시 (쿼리 파라미터 제외)
  try {
    const urlObj = new URL(url)
    const pathHash = simpleHash(urlObj.pathname)
    return `img_${pathHash}`
  } catch {
    // URL 파싱 실패 시 전체 URL 경로 해시
    const pathPart = url.split("?")[0]
    return `img_${simpleHash(pathPart)}`
  }
}

/**
 * 이미지 URL이 캐싱 가능한지 확인합니다.
 *
 * @param url - 이미지 URL
 * @returns 캐싱 가능 여부
 */
export function isCacheableUrl(url: string): boolean {
  if (!url) return false

  try {
    const urlObj = new URL(url)
    // 지원하는 프로토콜 확인
    if (urlObj.protocol !== "http:" && urlObj.protocol !== "https:") {
      return false
    }

    // 이미지 확장자 또는 이미지 관련 경로 확인
    const imageExtensions = [".jpg", ".jpeg", ".png", ".gif", ".webp", ".svg", ".bmp", ".ico"]
    const hasImageExtension = imageExtensions.some((ext) =>
      urlObj.pathname.toLowerCase().endsWith(ext)
    )

    // Notion S3 URL이나 이미지 확장자가 있는 경우 캐싱 가능
    if (url.includes("prod-files-secure.s3") || hasImageExtension) {
      return true
    }

    // 기타 경우도 캐싱 허용 (Content-Type으로 판별)
    return true
  } catch {
    return false
  }
}