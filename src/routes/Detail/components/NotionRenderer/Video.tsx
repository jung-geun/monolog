import { FC, useMemo } from "react"
import { Text } from "react-notion-x"

type VideoBlockProps = {
  block: any
  className?: string
}

type VideoSource = {
  url: string
  type: "youtube" | "vimeo" | "loom" | "googledrive" | "external"
  width?: number
  height?: number
  aspectRatio?: number
}

const parseVideoUrl = (url: string): { url: string; type: VideoSource["type"] } | null => {
  if (!url) return null

  // YouTube (embed 형식)
  const youtubeEmbedMatch = url.match(/youtube\.com\/embed\/([^"&?\/\s]{11})/)
  if (youtubeEmbedMatch) {
    return { url: youtubeEmbedMatch[1], type: "youtube" }
  }

  // YouTube (watch 형식)
  const youtubeWatchMatch = url.match(/youtube\.com\/watch\?v=([^"&?\/\s]{11})/)
  if (youtubeWatchMatch) {
    return { url: youtubeWatchMatch[1], type: "youtube" }
  }

  // YouTube (짧은 URL)
  const youtubeShortMatch = url.match(/youtu\.be\/([^"&?\/\s]{11})/)
  if (youtubeShortMatch) {
    return { url: youtubeShortMatch[1], type: "youtube" }
  }

  // Vimeo
  const vimeoMatch = url.match(/vimeo\.com\/(\d+)/)
  if (vimeoMatch) {
    return { url: vimeoMatch[1], type: "vimeo" }
  }

  // Loom
  if (url.includes("loom.com")) {
    return { url, type: "loom" }
  }

  // Google Drive
  if (url.includes("drive.google.com")) {
    return { url, type: "googledrive" }
  }

  // External video (direct MP4, etc.)
  return { url, type: "external" }
}

export const Video: FC<VideoBlockProps> = ({ block, className = "" }) => {
  const videoData = useMemo(() => {
    // react-notion-x는 block prop으로 BaseBlock을 직접 전달
    // 즉, block = recordMap.block[id].value
    const format = block?.format || {}
    const properties = block?.properties || {}

    let source: VideoSource | null = null

    // 1. properties.source 확인 (react-notion-x 방식)
    if (properties.source && Array.isArray(properties.source) && properties.source.length > 0) {
      const url = properties.source[0][0]
      if (url && typeof url === 'string') {
        const parsed = parseVideoUrl(url)
        if (parsed) {
          source = {
            ...parsed,
            width: format.block_width,
            height: format.block_height,
            aspectRatio: format.block_aspect_ratio
          }
        }
      }
    }

    // 2. format.display_source 확인
    if (!source && format.display_source) {
      const parsed = parseVideoUrl(format.display_source)
      if (parsed) {
        source = {
          ...parsed,
          width: format.block_width,
          height: format.block_height,
          aspectRatio: format.block_aspect_ratio
        }
      }
    }

    // 3. format.block_source 확인 (업로드된 비디오)
    if (!source && format.block_source) {
      for (const sourceItem of format.block_source) {
        if (sourceItem.url) {
          const parsed = parseVideoUrl(sourceItem.url)
          if (parsed) {
            source = {
              ...parsed,
              width: format.block_width,
              height: format.block_height,
              aspectRatio: format.block_aspect_ratio
            }
            break
          }
        }
      }
    }

    // 4. format.block_external 확인
    if (!source && format.block_external?.url) {
      const parsed = parseVideoUrl(format.block_external.url)
      if (parsed) {
        source = {
          ...parsed,
          width: format.block_width,
          height: format.block_height,
          aspectRatio: format.block_aspect_ratio
        }
      }
    }

    return source
  }, [block])

  if (!videoData) {
    return null
  }

  // 비디오 wrapper 스타일 계산
  const wrapperStyle: React.CSSProperties = {
    width: videoData.width ? `${videoData.width}px` : '100%',
    maxWidth: '100%',
    overflow: 'hidden',
    borderRadius: '4px',
    background: '#f1f1f1'
  }

  if (videoData.aspectRatio) {
    wrapperStyle.paddingBottom = `${100 / videoData.aspectRatio}%`
    wrapperStyle.height = 0
  } else if (videoData.width && videoData.height) {
    wrapperStyle.height = `${videoData.height}px`
  } else {
    wrapperStyle.paddingBottom = '56.25%' // 16:9
    wrapperStyle.height = 0
  }

  const renderVideo = () => {
    const iframeStyle = {
      position: 'absolute' as const,
      top: 0,
      left: 0,
      width: '100%',
      height: '100%',
      border: 'none'
    }

    switch (videoData.type) {
      case "youtube":
        return (
          <iframe
            src={`https://www.youtube.com/embed/${videoData.url}`}
            style={iframeStyle}
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
            title="YouTube video"
          />
        )

      case "vimeo":
        return (
          <iframe
            src={`https://player.vimeo.com/video/${videoData.url}`}
            style={iframeStyle}
            allow="autoplay; fullscreen; picture-in-picture"
            allowFullScreen
            title="Vimeo video"
          />
        )

      case "loom":
        const loomId = videoData.url.split("/").pop()
        return (
          <iframe
            src={`https://www.loom.com/embed/${loomId}`}
            style={iframeStyle}
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
            title="Loom video"
          />
        )

      case "googledrive":
        const driveId = videoData.url.match(/\/d\/([a-zA-Z0-9_-]+)/)?.[1]
        return (
          <iframe
            src={`https://drive.google.com/file/d/${driveId}/preview`}
            style={iframeStyle}
            allow="autoplay"
            title="Google Drive video"
          />
        )

      case "external":
        return (
          <video controls preload="metadata" style={iframeStyle}>
            <source src={videoData.url} />
            브라우저가 비디오 태그를 지원하지 않습니다.
          </video>
        )

      default:
        return null
    }
  }

  const caption = block?.properties?.caption

  return (
    <figure className="notion-asset-wrapper notion-asset-wrapper-video">
      <div className={`notion-video ${className}`}>
        <div className="notion-video-wrapper" style={wrapperStyle}>
          {renderVideo()}
        </div>
      </div>
      {caption && (
        <figcaption className="notion-asset-caption">
          <Text value={caption} block={block} />
        </figcaption>
      )}
    </figure>
  )
}

export default Video
