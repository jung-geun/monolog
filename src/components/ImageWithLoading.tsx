"use client"

import Image from "next/image"
import { useState, useEffect, useRef, useCallback } from "react"
import styled from "@emotion/styled"
import { imageCache } from "src/libs/utils/image/cache"

type Props = {
  src: string
  alt: string
  fill?: boolean
  width?: number
  height?: number
  className?: string
  /** 캐싱 활성화 여부 (기본값: true) */
  enableCache?: boolean
}

const ImageWithLoading: React.FC<Props> = ({
  src,
  alt,
  fill,
  width,
  height,
  className,
  enableCache = true,
}) => {
  const [isLoading, setIsLoading] = useState(true)
  const [cachedBlobUrl, setCachedBlobUrl] = useState<string | null>(null)
  const [useOriginal, setUseOriginal] = useState(false)
  const objectUrlRef = useRef<string | null>(null)
  const isMountedRef = useRef(true)

  // 캐시 조회
  useEffect(() => {
    isMountedRef.current = true

    if (!enableCache || !src) {
      setUseOriginal(true)
      return
    }

    const checkCache = async () => {
      try {
        const blobUrl = await imageCache.get(src)
        if (isMountedRef.current) {
          if (blobUrl) {
            // 캐시 히트: Blob URL 사용
            objectUrlRef.current = blobUrl
            setCachedBlobUrl(blobUrl)
            setIsLoading(false)
          } else {
            // 캐시 미스: 원본 URL 사용
            setUseOriginal(true)
          }
        } else {
          // 컴포넌트 언마운트된 경우 Blob URL 해제
          if (blobUrl) {
            URL.revokeObjectURL(blobUrl)
          }
        }
      } catch {
        if (isMountedRef.current) {
          setUseOriginal(true)
        }
      }
    }

    checkCache()

    return () => {
      isMountedRef.current = false
    }
  }, [src, enableCache])

  // Blob URL 정리
  useEffect(() => {
    return () => {
      if (objectUrlRef.current) {
        URL.revokeObjectURL(objectUrlRef.current)
        objectUrlRef.current = null
      }
    }
  }, [])

  // 이미지 로드 완료 후 캐시 저장
  const handleLoadComplete = useCallback(async () => {
    setIsLoading(false)

    // 캐시가 활성화되어 있고 원본 URL을 사용한 경우만 캐시 저장
    if (enableCache && useOriginal && src) {
      try {
        // 이미지 fetch하여 캐시에 저장
        const response = await fetch(src)
        if (response.ok) {
          const blob = await response.blob()
          await imageCache.set(src, blob)
        }
      } catch {
        // 캐시 저장 실패 무시
      }
    }
  }, [enableCache, useOriginal, src])

  // 캐시된 Blob URL을 사용하는 경우 (일반 img 태그)
  if (cachedBlobUrl && !useOriginal) {
    return (
      <StyledWrapper className={className}>
        {isLoading && (
          <SkeletonOverlay>
            <LoadingIcon>?</LoadingIcon>
          </SkeletonOverlay>
        )}
        <StyledImage
          src={cachedBlobUrl}
          alt={alt}
          $fill={fill}
          $width={width}
          $height={height}
          css={{
            objectFit: "cover",
            opacity: isLoading ? 0 : 1,
            transition: "opacity 0.3s ease-in-out",
          }}
          onLoad={() => setIsLoading(false)}
        />
      </StyledWrapper>
    )
  }

  // 원본 URL을 사용하는 경우 (Next.js Image)
  return (
    <StyledWrapper className={className}>
      {isLoading && (
        <SkeletonOverlay>
          <LoadingIcon>?</LoadingIcon>
        </SkeletonOverlay>
      )}
      <Image
        src={src}
        alt={alt}
        fill={fill}
        width={width}
        height={height}
        css={{
          objectFit: "cover",
          opacity: isLoading ? 0 : 1,
          transition: "opacity 0.3s ease-in-out",
        }}
        onLoadingComplete={handleLoadComplete}
      />
    </StyledWrapper>
  )
}

export default ImageWithLoading

const StyledWrapper = styled.div`
  position: absolute;
  inset: 0;
`

const SkeletonOverlay = styled.div`
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  background: linear-gradient(
    90deg,
    ${({ theme }) => theme.colors.gray3} 0%,
    ${({ theme }) => theme.colors.gray4} 50%,
    ${({ theme }) => theme.colors.gray3} 100%
  );
  background-size: 200% 100%;
  animation: shimmer 1.5s infinite;
  z-index: 1;

  @keyframes shimmer {
    0% {
      background-position: 200% 0;
    }
    100% {
      background-position: -200% 0;
    }
  }
`

const LoadingIcon = styled.span`
  font-size: 2rem;
  font-weight: 700;
  color: ${({ theme }) => theme.colors.gray8};
`

// 캐시된 이미지용 스타일드 컴포넌트
const StyledImage = styled.img<{ $fill?: boolean; $width?: number; $height?: number }>`
  position: ${({ $fill }) => ($fill ? "absolute" : "relative")};
  inset: ${({ $fill }) => ($fill ? "0" : "auto")};
  width: ${({ $fill, $width }) => ($fill ? "100%" : $width ? `${$width}px` : "auto")};
  height: ${({ $fill, $height }) => ($fill ? "100%" : $height ? `${$height}px` : "auto")};
`