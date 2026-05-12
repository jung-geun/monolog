import dynamic from "next/dynamic"
import Image from "next/image"
import Link from "next/link"
import Script from "next/script"
import { useRouter } from "next/router"
import { createPortal } from "react-dom"
import { ExtendedRecordMap, Block } from "notion-types"
import useScheme from "src/hooks/useScheme"
import DatabasePlaceholder from "src/components/DatabasePlaceholder"
import NotionDatabase from "src/components/NotionDatabase"
import { useDatabaseQuery } from "src/hooks/useDatabasesQuery"
import { useDatabasePortalTargets } from "./useDatabasePortalTargets"
import { useListItemColorEffect } from "./useListItemColorEffect"
import { useEffect, useMemo, useCallback } from "react"
import { customMapImageUrl } from "src/libs/utils/notion/customMapImageUrl"
import { unwrapBlock } from "src/libs/utils/notion/unwrapBlock"
import {
  buildIdToSlug,
  rewriteRecordMapInternalLinks,
} from "src/libs/utils/notion/rewriteInternalLinks"
import usePostsQuery from "src/hooks/usePostsQuery"

// core styles shared by all of react-notion-x (required)
import "react-notion-x/src/styles.css"

// used for code syntax highlighting (optional)
import "prismjs/themes/prism-tomorrow.css"

// used for rendering equations (optional)

import "katex/dist/katex.min.css"
import { FC } from "react"
import styled from "@emotion/styled"

// Type declarations for KaTeX global functions
declare global {
  interface Window {
    katex: any
    renderMathInElement: any
    renderMathManually?: (targetElement?: Element) => void
  }
}

const _NotionRenderer = dynamic(
  () => import("react-notion-x").then((m) => m.NotionRenderer),
  { ssr: false }
)

const Code = dynamic(() =>
  import("react-notion-x/build/third-party/code").then(async (m) => m.Code)
)

const Collection = dynamic(() =>
  import("react-notion-x/build/third-party/collection").then(
    (m) => m.Collection
  )
)
const Equation = dynamic(() =>
  import("react-notion-x/build/third-party/equation").then((m) => m.Equation)
)
const Pdf = dynamic(
  () => import("react-notion-x/build/third-party/pdf").then((m) => m.Pdf),
  {
    ssr: false,
  }
)
const Modal = dynamic(
  () => import("react-notion-x/build/third-party/modal").then((m) => m.Modal),
  {
    ssr: false,
  }
)

const Video = dynamic(
  () => import("./Video").then((m) => m.Video),
  {
    ssr: false,
  }
)

const Audio = dynamic(
  () => import("./Audio").then((m) => m.Audio),
  {
    ssr: false,
  }
)

const mapImageUrlWrapper = (url: string | undefined, block: Block) => {
  if (!url) return ""
  return customMapImageUrl(url, block, { source: 'recordMap' })
}

type Props = {
  recordMap: ExtendedRecordMap | null
}

// Renders a single database block: fetches from React Query cache; falls back to placeholder.
const DatabaseBlockRenderer: FC<{ databaseId: string; title: string }> = ({ databaseId, title }) => {
  const database = useDatabaseQuery(databaseId)
  if (database) return <NotionDatabase database={database} />
  return <DatabasePlaceholder databaseId={databaseId} title={title} />
}

const NotionRenderer: FC<Props> = ({ recordMap }) => {
  const [scheme] = useScheme()
  const allPosts = usePostsQuery()

  // Pre-built id → slug map of every post in this blog DB.
  const idToSlug = useMemo(() => buildIdToSlug(allPosts), [allPosts])

  // Pre-rewrite the recordMap so any inline notion.so link that points to a
  // sibling post becomes /{slug} BEFORE react-notion-x renders it. This avoids
  // post-render DOM mutation; the rendered <a> already has the correct href.
  const internalRecordMap = useMemo(
    () => rewriteRecordMapInternalLinks(recordMap, idToSlug),
    [recordMap, idToSlug]
  )
  const portalTargets = useDatabasePortalTargets(internalRecordMap)

  const mapPageUrl = useCallback((pageId: string) => {
    const slug = idToSlug.get(pageId.replace(/-/g, "").toLowerCase())
    return slug ? `/${slug}` : "https://www.notion.so/" + pageId.replace(/-/g, "")
  }, [idToSlug])

  const router = useRouter()

  // The rewritten recordMap gives every internal link an `/slug` href. Some
  // react-notion-x renderers still emit `target="_blank" rel="noopener"`, which
  // would open the internal slug in a *browser* tab instead of the in-app
  // EditorChrome tab. Intercept on the capture phase so we beat any default
  // navigation, and route internal hrefs through the SPA. useRegisterChrome
  // on the destination route then opens / activates the in-app tab.
  useEffect(() => {
    if (typeof window === 'undefined') return
    const container = document.querySelector('.notion-page') as HTMLElement | null
    if (!container) return

    const onClick = (e: MouseEvent) => {
      if (e.defaultPrevented) return
      if (e.button !== 0) return
      if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return
      const a = (e.target as HTMLElement | null)?.closest('a') as HTMLAnchorElement | null
      if (!a) return
      const href = a.getAttribute('href')
      if (!href) return
      if (!href.startsWith('/') || href.startsWith('//')) return
      // Internal — always SPA, regardless of target="_blank" / rel.
      e.preventDefault()
      e.stopPropagation()
      router.push(href)
    }
    container.addEventListener('click', onClick, { capture: true })
    return () => container.removeEventListener('click', onClick, { capture: true } as any)
  }, [router, internalRecordMap])

  // Log all blocks in the current page (dev/test only)
  useEffect(() => {
    if (!recordMap) return

    const blocks = Object.entries(recordMap.block)
    const totalBlocks = blocks.length

    // Count blocks by type
    const typeStats: Record<string, number> = {}
    const specialBlocks: Array<{ id: string; type: string; info?: string }> = []

    blocks.forEach(([blockId, blockData]) => {
      const type = unwrapBlock(blockData)?.type ?? 'unknown'
      typeStats[type] = (typeStats[type] ?? 0) + 1

      // Track special blocks
      if (['collection_view_page', 'collection_view', 'image', 'video', 'audio', 'pdf', 'file', 'equation'].includes(type)) {
        specialBlocks.push({ id: blockId, type })
      }
    })

    if (process.env.NODE_ENV !== 'production') {
      console.group('📋 [Page Blocks]')
      console.log(`Total blocks: ${totalBlocks}`)

      console.group('📊 Block Types Summary:')
      Object.entries(typeStats)
        .sort(([, a], [, b]) => b - a)
        .forEach(([type, count]) => {
          console.log(`  ${type}: ${count}`)
        })
      console.groupEnd()

      if (specialBlocks.length > 0) {
        console.group('🎯 Special Blocks:')
        specialBlocks.forEach(({ id, type }) => {
          console.log(`  ${id} | type: ${type}`)
        })
        console.groupEnd()
      }

      console.group('📄 All Blocks:')
      blocks.forEach(([blockId, blockData], index) => {
        const type = unwrapBlock(blockData)?.type ?? 'unknown'
        const role = blockData.role
        console.log(`  [${index + 1}] ${blockId} | type: ${type} | role: ${role}`)
      })
      console.groupEnd()
      console.groupEnd()
    }
  }, [recordMap])
  // Apply colors to list items (bullets, backgrounds) that might be missed by react-notion-x
  useListItemColorEffect(recordMap)

  useEffect(() => {
    document.querySelectorAll<HTMLAnchorElement>('.notion-page-link').forEach((el) => {
      if (!el.textContent?.trim() && !el.getAttribute('aria-label')) {
        el.setAttribute('aria-label', '페이지')
      }
    })
  }, [recordMap])

  // RNX renders user mentions as a bare <img class="notion-user"> with no
  // accompanying text — visually it's a 1em circle most readers won't
  // notice. Wrap each one in a pill with the @name pulled from `alt`, so
  // mentions read inline like the Notion source. Idempotent: skips images
  // already inside a `.notion-user-pill` parent. Observer attaches to body
  // because `_NotionRenderer` is a `ssr: false` dynamic import — the
  // .notion-page container is created after this useEffect first fires.
  useEffect(() => {
    if (!recordMap || typeof window === 'undefined') return
    const enhance = () => {
      const imgs = document.querySelectorAll<HTMLImageElement>('img.notion-user')
      imgs.forEach((img) => {
        if (img.parentElement?.classList.contains('notion-user-pill')) return
        const name = img.getAttribute('alt') || ''
        const pill = document.createElement('span')
        pill.className = 'notion-user-pill'
        const nameSpan = document.createElement('span')
        nameSpan.className = 'notion-user-name'
        nameSpan.textContent = name ? `@${name}` : ''
        img.replaceWith(pill)
        pill.appendChild(img)
        if (name) pill.appendChild(nameSpan)
      })
    }
    enhance()
    const obs = new MutationObserver(enhance)
    obs.observe(document.body, { childList: true, subtree: true })
    return () => obs.disconnect()
  }, [recordMap])

  // KaTeX math rendering effect - moved to top level to follow React Hooks rules
  useEffect(() => {
    // Only run on client side and when recordMap is available
    if (!recordMap || typeof window === 'undefined') return

    // Check if KaTeX is available
    const checkAndRenderMath = () => {
      if (!window.katex) {
        if (process.env.NODE_ENV !== 'production') {
          console.log('KaTeX: Not available, skipping math rendering')
        }
        return
      }

      // Look for inline math expressions that weren't rendered by Equation component
      const notionPage = document.querySelector('.notion-page')
      if (!notionPage) return

      // Find all text content that might contain math delimiters
      const allTextElements = notionPage.querySelectorAll('p, span, div')
      let foundMath = false

      allTextElements.forEach(element => {
        const text = element.textContent || ''
        // Check for unrendered math expressions
        if ((text.includes('$') || text.includes('\\(') || text.includes('\\[')) &&
          !element.querySelector('.katex') &&
          !element.classList.contains('katex')) {

          // Try to render math in this element
          try {
            window.renderMathInElement(element, {
              delimiters: [
                { left: '$$', right: '$$', display: true },
                { left: '$', right: '$', display: false },
                { left: '\\[', right: '\\]', display: true },
                { left: '\\(', right: '\\)', display: false }
              ],
              throwOnError: false
            })
            foundMath = true
          } catch (error) {
            if (process.env.NODE_ENV !== 'production') {
              console.warn('KaTeX: Failed to render math in element:', error)
            }
          }
        }
      })

      if (process.env.NODE_ENV !== 'production') {
        console.log(`KaTeX: ${foundMath ? 'Found and rendered math' : 'No unrendered math found'}`)
      }
    }

    setTimeout(checkAndRenderMath, 1000)

    let mathTimer: ReturnType<typeof setTimeout>
    const observer = new MutationObserver(() => {
      clearTimeout(mathTimer)
      mathTimer = setTimeout(checkAndRenderMath, 500)
    })

    const notionPage = document.querySelector('.notion-page') ?? document.body
    observer.observe(notionPage, { childList: true, subtree: true })

    // Manual re-render function for debugging
    window.renderMathManually = checkAndRenderMath

    return () => {
      observer.disconnect()
      delete window.renderMathManually
    }
  }, [recordMap]) // Re-run when recordMap changes

  // YouTube 라이트 로딩을 iframe으로 교체 및 오디오 블록 렌더링
  useEffect(() => {
    if (!recordMap || typeof window === 'undefined') return

    const replaceYouTubeLite = () => {
      const ytLiteElements = document.querySelectorAll('.notion-yt-lite')

      ytLiteElements.forEach((element) => {
        // 이미 처리된 요소는 건너뜀
        if (element.hasAttribute('data-yt-processed')) return

        // 썸네일에서 YouTube ID 추출
        const img = element.querySelector('img.notion-yt-thumbnail')
        if (!img) return

        const src = img.getAttribute('src')
        if (!src) return

        const match = src.match(/vi\/([^\/]+)\//)
        if (!match) return

        const videoId = match[1]

        // iframe 생성
        const iframe = document.createElement('iframe')
        iframe.src = `https://www.youtube.com/embed/${videoId}`
        iframe.style.cssText = 'width: 100%; height: 100%; border: none; position: absolute; top: 0; left: 0;'
        iframe.allow = 'accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture'
        iframe.allowFullscreen = true
        iframe.title = 'YouTube video'

        // 부모 요소 스타일 수정
        const parent = element.parentElement
        if (parent) {
          parent.style.position = 'relative'
          parent.style.paddingBottom = '56.25%'
          parent.style.height = '0'
          parent.style.width = 'auto'
          parent.style.maxWidth = '100%'
          parent.style.overflow = 'hidden'
          parent.style.borderRadius = '4px'
          parent.style.background = '#f1f1f1'
        }

        // 교체
        element.replaceWith(iframe)
        element.setAttribute('data-yt-processed', 'true')

        // figure 요소 찾아서 제거하고 iframe만 남기기
        setTimeout(() => {
          const figure = iframe.closest('figure.notion-asset-wrapper-video')
          if (figure) {
            const figureParent = figure.parentElement
            if (figureParent) {
              // 새로운 wrapper 생성
              const wrapper = document.createElement('div')
              wrapper.style.cssText = 'position: relative; width: 100%; max-width: 100%; padding-bottom: 56.25%; height: 0; overflow: hidden; border-radius: 4px; background: #f1f1f1; margin: 1rem 0;'

              // iframe 스타일 수정 (wrapper 내에서 absolute)
              iframe.style.cssText = 'width: 100%; height: 100%; border: none; position: absolute; top: 0; left: 0;'

              // wrapper에 iframe 추가
              wrapper.appendChild(iframe)

              // wrapper를 figure 밖으로 이동
              figureParent.insertBefore(wrapper, figure)

              // figure 제거
              figure.remove()
            }
          }
        }, 100)
      })
    }

    // 오디오 블록 렌더링 (react-notion-x가 오디오를 지원하지 않으므로 직접 처리)
    const renderAudioBlocks = () => {
      // recordMap에서 audio 타입 블록 찾기
      Object.entries(recordMap.block).forEach(([blockId, blockData]) => {
        const blockValue = unwrapBlock(blockData)
        if (blockValue?.type === 'audio') {
          const element = document.querySelector(`[data-block-id="${blockId}"]`)
          if (!element || element.hasAttribute('data-audio-processed')) return
          const format = (blockValue.format || {}) as any
          const properties = blockValue.properties || {}

          let audioUrl = null

          // URL 파싱 - 여러 소스 확인
          if (properties.source && Array.isArray(properties.source) && properties.source.length > 0) {
            audioUrl = properties.source[0][0]
          }
          if (!audioUrl && format.display_source) {
            audioUrl = format.display_source
          }
          if (!audioUrl && format.block_source) {
            for (const sourceItem of format.block_source) {
              if (sourceItem.url) {
                audioUrl = sourceItem.url
                break
              }
            }
          }

          if (audioUrl) {
            const wrapper = document.createElement('div')
            wrapper.className = 'notion-audio-wrapper'
            wrapper.style.cssText = 'margin: 1rem 0;'

            const audioEl = document.createElement('audio')
            audioEl.controls = true
            audioEl.preload = 'metadata'
            audioEl.style.cssText = 'width: 100%; max-width: 100%;'

            const sourceEl = document.createElement('source')
            sourceEl.src = audioUrl

            audioEl.appendChild(sourceEl)
            wrapper.appendChild(audioEl)

            element.innerHTML = ''
            element.appendChild(wrapper)
            element.setAttribute('data-audio-processed', 'true')

            if (process.env.NODE_ENV !== 'production') {
              console.log('🎵 [Audio] Rendered audio block from recordMap:', blockId, audioUrl)
            }
          }
        }
      })
    }

    setTimeout(replaceYouTubeLite, 500)
    setTimeout(renderAudioBlocks, 500)

    let ytTimer: ReturnType<typeof setTimeout>
    const observer = new MutationObserver(() => {
      clearTimeout(ytTimer)
      ytTimer = setTimeout(() => { replaceYouTubeLite(); renderAudioBlocks() }, 300)
    })

    const notionPage = document.querySelector('.notion-page') ?? document.body
    observer.observe(notionPage, { childList: true, subtree: true })

    return () => {
      observer.disconnect()
    }
  }, [recordMap])

  // Refresh expired image URLs on load failure
  useEffect(() => {
    if (!recordMap || typeof window === 'undefined') return

    const refreshImageOnLoadError = async (img: HTMLImageElement, blockId: string) => {
      try {
        if (process.env.NODE_ENV !== 'production') {
          console.log(`🔄 [ImageRefresh] Refreshing image for block ${blockId}`)
        }

        const response = await fetch(`/api/refresh-image?blockId=${encodeURIComponent(blockId)}`)
        if (!response.ok) {
          throw new Error(`Failed to refresh: ${response.status}`)
        }

        const data = await response.json()
        if (!data.url) {
          throw new Error('No URL in response')
        }

        if (process.env.NODE_ENV !== 'production') {
          console.log(`✅ [ImageRefresh] Refreshed URL for block ${blockId}`)
        }

        // Construct Notion proxy URL with fresh S3 URL
        const notionProxyUrl = new URL('https://www.notion.so/image/' + encodeURIComponent(data.url))
        notionProxyUrl.searchParams.set('cache', 'v2')
        notionProxyUrl.searchParams.set('table', 'block')
        notionProxyUrl.searchParams.set('id', blockId)

        const freshUrl = notionProxyUrl.toString()

        // Update the image source
        img.src = freshUrl

      } catch (error) {
        if (process.env.NODE_ENV !== 'production') {
          console.error(`❌ [ImageRefresh] Failed to refresh image for block ${blockId}:`, error)
        }
      }
    }

    // Track blocks that have been attempted to refresh to avoid infinite loops
    const refreshAttempts = new Set<string>()

    const handleImageError = (event: Event) => {
      const img = event.target as HTMLImageElement
      const container = img.closest('[data-block-id]')

      if (!container) return

      const blockId = container.getAttribute('data-block-id')
      if (!blockId) return

      // Skip if already attempted to refresh this block
      if (refreshAttempts.has(blockId)) {
        if (process.env.NODE_ENV !== 'production') {
          console.log(`⏭️ [ImageRefresh] Already attempted to refresh block ${blockId}, skipping`)
        }
        return
      }

      refreshAttempts.add(blockId)

      // Check if this is a Notion proxy URL that might be expired
      const currentSrc = img.src
      if (currentSrc.includes('notion.so/image/') || currentSrc.includes('amazonaws.com')) {
        if (process.env.NODE_ENV !== 'production') {
          console.log(`⚠️ [ImageRefresh] Image load failed for block ${blockId}, attempting refresh`)
        }
        refreshImageOnLoadError(img, blockId)
      }
    }

    const observer = new MutationObserver(() => {
      const images = document.querySelectorAll('img.notion-asset-wrapper-image, img.medium-zoom-image')
      images.forEach(img => {
        img.removeEventListener('error', handleImageError)
        img.addEventListener('error', handleImageError)
      })
    })

    const notionPage = document.querySelector('.notion-page') ?? document.body
    observer.observe(notionPage, { childList: true, subtree: true })

    return () => {
      observer.disconnect()
      const images = document.querySelectorAll('img.notion-asset-wrapper-image, img.medium-zoom-image')
      images.forEach(img => {
        img.removeEventListener('error', handleImageError)
      })
    }
  }, [recordMap])

  // Handle case where recordMap is not available
  if (!recordMap) {
    return (
      <StyledWrapper>
        <div style={{
          padding: '2rem',
          textAlign: 'center',
          color: 'var(--theme-colors-gray11)'
        }}>
          <p>콘텐츠를 불러오는 중 문제가 발생했습니다.</p>
          <p>잠시 후 다시 시도해주세요.</p>
        </div>
      </StyledWrapper>
    )
  }

  // Find all database blocks
  const databaseBlocks: Array<{ blockId: string; databaseId: string; title: string }> = []

  Object.entries(recordMap.block).forEach(([blockId, blockData]) => {
    const block = unwrapBlock(blockData)
    if (block?.type === 'collection_view_page') {
      const databaseId = (block.format as any)?.database_id || blockId
      const title = block.properties?.title?.[0]?.[0] || '데이터베이스'
      databaseBlocks.push({ blockId, databaseId, title })
    }
  })

  return (
    <StyledWrapper className={scheme === 'dark' ? 'dark' : 'light'}>
      <Script
        src="https://cdn.jsdelivr.net/npm/katex@0.16.9/dist/katex.min.js"
        strategy="lazyOnload"
      />
      <Script
        src="https://cdn.jsdelivr.net/npm/katex@0.16.9/dist/contrib/auto-render.min.js"
        strategy="lazyOnload"
      />
      <_NotionRenderer
        darkMode={scheme === "dark"}
        recordMap={internalRecordMap ?? recordMap}
        components={{
          Code,
          Collection,
          Equation,
          Modal,
          Pdf,
          Video,
          video: Video,
          Audio,
          audio: Audio,
          nextImage: Image,
          nextLink: Link,
        } as any}
        mapPageUrl={mapPageUrl}
        mapImageUrl={mapImageUrlWrapper}
      />

      {databaseBlocks.map(({ blockId, databaseId, title }) => {
        const target = portalTargets.get(blockId)
        if (!target?.isConnected) return null
        return createPortal(
          <DatabaseBlockRenderer databaseId={databaseId} title={title} />,
          target,
          `db-${blockId}`
        )
      })}
    </StyledWrapper>
  )
}

export default NotionRenderer

const StyledWrapper = styled.div`
  /* // TODO: why render? */
  .notion-collection-page-properties {
    display: none !important;
  }
  .notion-page {
    padding: 0;
  }
  .notion-list {
    width: 100%;
  }
  
  /* Hide default collection_view_page rendering - we use custom DatabasePlaceholder */
  .notion-collection_view_page,
  .notion-collection-view,
  .notion-collection_view {
    display: none !important;
  }
  
  /* Handle synced_block: hide the container but show children */
  .notion-synced-block {
    display: none !important;
  }
  
  /* Make sure synced_block children are visible */
  .notion-synced-block > .notion-block {
    display: block !important;
  }
  
  /* Hide unsupported block type containers (table_of_contents is supported) */
  .notion-breadcrumb,
  .notion-transclusion_container {
    display: none !important;
  }

  /* to_do checkboxes are read-only — clicks would not persist back to Notion.
     Disable interaction and signal read-only intent. */
  .notion-to-do-item .notion-property-checkbox {
    cursor: default;
    pointer-events: none;
  }

  /* Audio block styling */
  .notion-audio {
    margin: 1rem 0;
  }
  
  .notion-audio-wrapper {
    width: 100%;
    max-width: 100%;
  }
  
  .notion-audio audio {
    width: 100%;
    max-width: 100%;
  }
  
  /* Dark mode audio styling */
  &.dark .notion-audio audio {
    background: #2a2a2a;
    border-radius: 4px;
  }
  
  /* Database portal targets — managed by useDatabasePortalTargets */
  .database-portal-target {
    display: block;
    width: 100%;
    margin: 1rem 0;
  }
  
  /* Always show code block copy button */
  .notion-code-copy {
    opacity: 1 !important;
    visibility: visible !important;
  }
  
  .notion-code-copy-button {
    opacity: 1 !important;
    visibility: visible !important;
    cursor: pointer;
    transition: opacity 0.2s ease;
    
    &:hover {
      opacity: 0.7 !important;
    }
  }
  
  /* KaTeX math styling for dark mode */
  .katex {
    font-size: 1em !important;
  }
  
  .katex-display {
    margin: 1em 0 !important;
  }
  
  /* Dark mode KaTeX styling */
  [data-theme="dark"] .katex,
  .dark .katex {
    color: #e6e6e6 !important;
  }
  
  [data-theme="dark"] .katex .katex-mathml,
  .dark .katex .katex-mathml {
    color: #e6e6e6 !important;
  }
  
  /* Math delimiters styling */
  [data-theme="dark"] .katex .delimsizing,
  .dark .katex .delimsizing {
    color: #e6e6e6 !important;
  }
  
  [data-theme="dark"] .katex .delimsizing.size1,
  .dark .katex .delimsizing.size1 {
    color: #e6e6e6 !important;
  }
  
  /* Ensure math equations are visible in dark mode */
  .notion-equation {
    background: transparent !important;
  }
  
  [data-theme="dark"] .notion-equation,
  .dark .notion-equation {
    background: transparent !important;
  }
  
  /* Notion color classes - Light mode */
  .notion-default {
    color: var(--theme-colors-gray12);
  }
  .notion-gray {
    color: var(--theme-colors-gray9);
  }
  .notion-brown {
    color: #9f6b53;
  }
  .notion-orange {
    color: #d9730d;
  }
  .notion-yellow {
    color: #dfab01;
  }
  .notion-green {
    color: #0f7b6c;
  }
  .notion-blue {
    color: #0b6e99;
  }
  .notion-purple {
    color: #6940a5;
  }
  .notion-pink {
    color: #ad3a6a;
  }
  .notion-red {
    color: #d92a2a;
  }
  
  /* Notion background color classes - Light mode */
  .notion-default_background {
    background-color: transparent;
  }
  .notion-gray_background {
    background-color: var(--theme-colors-gray4);
  }
  .notion-brown_background {
    background-color: #f3e9e7;
  }
  .notion-orange_background {
    background-color: #faebdd;
  }
  .notion-yellow_background {
    background-color: #fbf3db;
  }
  .notion-green_background {
    background-color: #ddedea;
  }
  .notion-blue_background {
    background-color: #d6eaf3;
  }
  .notion-purple_background {
    background-color: #eae4f2;
  }
  .notion-pink_background {
    background-color: #f4e5ed;
  }
  .notion-red_background {
    background-color: #fbe4e4;
  }
  
  /* Dark mode color adjustments */
  &.dark .notion-default { color: #FFFFFF; }
  &.dark .notion-gray { color: #9B9B9B; }
  &.dark .notion-brown { color: #937264; }
  &.dark .notion-orange { color: #FFA344; }
  &.dark .notion-yellow { color: #FFDC49; }
  &.dark .notion-green { color: #4DAB9A; }
  &.dark .notion-blue { color: #529CCA; }
  &.dark .notion-purple { color: #9A6DD7; }
  &.dark .notion-pink { color: #E255A1; }
  &.dark .notion-red { color: #FF7369; }
  
  /* Dark mode background color adjustments */
  &.dark .notion-gray_background { background-color: #454B4E; }
  &.dark .notion-brown_background { background-color: #434040; }
  &.dark .notion-orange_background { background-color: #594A3A; }
  &.dark .notion-yellow_background { background-color: #59563B; }
  &.dark .notion-green_background { background-color: #354C4B; }
  &.dark .notion-blue_background { background-color: #364954; }
  &.dark .notion-purple_background { background-color: #443F57; }
  &.dark .notion-pink_background { background-color: #533B4C; }
  &.dark .notion-red_background { background-color: #594141; }

  /* Notion database item colors (tags, etc) */
  .notion-item-default { background-color: rgba(206, 205, 202, 0.5); color: var(--fg-color); }
  .notion-item-gray { background-color: rgba(155, 154, 151, 0.4); color: var(--fg-color); }
  .notion-item-brown { background-color: rgba(140, 46, 0, 0.2); color: var(--fg-color); }
  .notion-item-orange { background-color: rgba(245, 93, 0, 0.2); color: var(--fg-color); }
  .notion-item-yellow { background-color: rgba(233, 168, 0, 0.2); color: var(--fg-color); }
  .notion-item-green { background-color: rgba(0, 135, 107, 0.2); color: var(--fg-color); }
  .notion-item-blue { background-color: rgba(0, 120, 223, 0.2); color: var(--fg-color); }
  .notion-item-purple { background-color: rgba(103, 36, 222, 0.2); color: var(--fg-color); }
  .notion-item-pink { background-color: rgba(221, 0, 129, 0.2); color: var(--fg-color); }
  .notion-item-red { background-color: rgba(255, 0, 26, 0.2); color: var(--fg-color); }

  &.dark .notion-item-default { background-color: rgba(206, 205, 202, 0.5); }
  &.dark .notion-item-gray { background-color: rgba(151, 154, 155, 0.5); }
  &.dark .notion-item-brown { background-color: rgba(147, 114, 100, 0.5); }
  &.dark .notion-item-orange { background-color: rgba(255, 163, 68, 0.5); }
  &.dark .notion-item-yellow { background-color: rgba(255, 220, 73, 0.5); }
  &.dark .notion-item-green { background-color: rgba(77, 171, 154, 0.5); }
  &.dark .notion-item-blue { background-color: rgba(82, 156, 202, 0.5); }
  &.dark .notion-item-purple { background-color: rgba(154, 109, 215, 0.5); }
  &.dark .notion-item-pink { background-color: rgba(226, 85, 161, 0.5); }
  &.dark .notion-item-red { background-color: rgba(255, 115, 105, 0.5); }

  /* Equation block styling */
  .notion-equation-block {
    text-align: center;
    overflow: auto;
  }
  
  .notion-equation-block .katex-display {
    margin: 1em 0;
  }
  
  .notion-equation-block .katex {
    font-size: 1.3em;
  }
  
  /* Inline equation styling to ensure visibility */
  .notion-inline-equation .katex {
    font-size: 1em;
  }
  
  /* Video block styling */
  .notion-video {
    margin: 1rem 0;
  }
  
  .notion-video-wrapper {
    position: relative;
  }
  
  /* Dark mode video background */
  &.dark .notion-video-wrapper {
    background: #2a2a2a;
  }
  
  /* 비디오 asset wrapper 스타일 수정 */
  .notion-asset-wrapper {
    width: auto !important;
    max-width: 100% !important;
  }
  
  .notion-asset-wrapper-video {
    width: auto !important;
    max-width: 100% !important;
  }
  
  .notion-asset-wrapper-video > div {
    width: auto !important;
    max-width: 100% !important;
  }
  
  .notion-asset-wrapper-video video {
    max-width: 100% !important;
    height: auto !important;
  }
  
  /* 메인 컨테이너 내에서만 비디오 표시 */
  .notion-page .notion-asset-wrapper-video {
    max-width: 100%;
    overflow: hidden;
  }
  
  /* YouTube 라이트 로딩 숨기기 */
  .notion-yt-lite {
    display: none !important;
  }

  /* Image / asset captions: Notion centers the caption under the image.
     RNX defaults to left-align which makes blog posts look unbalanced. */
  .notion-asset-caption {
    text-align: center;
    font-size: 0.875em;
    color: rgb(var(--c-mute, 102 104 94));
    margin-top: 0.5rem;
  }

  /* User mention: RNX renders a tiny <img class="notion-user"> with no
     accompanying text, which the user almost cannot see. Bump it to a
     pill that pairs the avatar with the @name (taken from the alt
     attribute) so mentions read naturally inline. */
  .notion-user {
    display: inline-block;
    width: 1em;
    height: 1em;
    border-radius: 50%;
    object-fit: cover;
    vertical-align: -0.15em;
    margin: 0 0.15em;
  }
  .notion-user::after {
    /* attr(alt) on a replaced element is unreliable across engines, so
       text fallback is handled by enhanceUserMentions runtime helper. */
  }
  .notion-user-pill {
    display: inline-flex;
    align-items: center;
    gap: 0.2em;
    padding: 0.05em 0.35em 0.05em 0.1em;
    border-radius: 999px;
    background: rgb(var(--c-elevated, 215 202 168) / 0.5);
    color: inherit;
    line-height: 1.4;
    vertical-align: -0.15em;
  }
  .notion-user-pill > img.notion-user {
    margin: 0;
  }
  .notion-user-pill > .notion-user-name {
    font-size: 0.95em;
  }
`
