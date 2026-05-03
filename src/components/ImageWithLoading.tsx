"use client"

import Image from "next/image"
import { useState } from "react"
import styled from "@emotion/styled"

type Props = {
  src: string
  alt: string
  fill?: boolean
  width?: number
  height?: number
  className?: string
  priority?: boolean
  sizes?: string
}

const ImageWithLoading: React.FC<Props> = ({
  src,
  alt,
  fill,
  width,
  height,
  className,
  priority,
  sizes,
}) => {
  const [isLoading, setIsLoading] = useState(true)

  return (
    <StyledWrapper className={className}>
      {isLoading && <SkeletonOverlay />}
      <Image
        src={src}
        alt={alt}
        fill={fill}
        width={width}
        height={height}
        priority={priority}
        sizes={sizes}
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

export default ImageWithLoading

const StyledWrapper = styled.div`
  position: absolute;
  inset: 0;
`

const SkeletonOverlay = styled.div`
  position: absolute;
  inset: 0;
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
