import { FC, useMemo } from "react"
import { Text } from "react-notion-x"

type AudioBlockProps = {
  block: any
  className?: string
}

type AudioSource = {
  url: string
  type: "external"
}

export const Audio: FC<AudioBlockProps> = ({ block, className = "" }) => {
  const audioData = useMemo(() => {
    // react-notion-x는 block prop으로 BaseBlock을 직접 전달
    // 즉, block = recordMap.block[id].value
    const format = block?.format || {}
    const properties = block?.properties || {}

    let source: AudioSource | null = null

    // 1. properties.source 확인 (react-notion-x 방식)
    if (properties.source && Array.isArray(properties.source) && properties.source.length > 0) {
      const url = properties.source[0][0]
      if (url && typeof url === 'string') {
        source = { url, type: 'external' }
      }
    }

    // 2. format.display_source 확인
    if (!source && format.display_source) {
      source = { url: format.display_source, type: 'external' }
    }

    // 3. format.block_source 확인
    if (!source && format.block_source) {
      for (const sourceItem of format.block_source) {
        if (sourceItem.url) {
          source = { url: sourceItem.url, type: 'external' }
          break
        }
      }
    }

    return source
  }, [block])

  if (!audioData) {
    return null
  }

  const caption = block?.properties?.caption

  return (
    <figure className="notion-asset-wrapper notion-asset-wrapper-audio">
      <div className={`notion-audio ${className}`}>
        <div className="notion-audio-wrapper">
          <audio controls preload="metadata">
            <source src={audioData.url} />
            브라우저가 오디오 태그를 지원하지 않습니다.
          </audio>
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

export default Audio
