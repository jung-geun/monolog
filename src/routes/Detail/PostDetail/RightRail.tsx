import { useEffect, useMemo, useState } from "react"
import Link from "next/link"
import styled from "@emotion/styled"
import { ExtendedRecordMap } from "notion-types"
import { uuidToId } from "notion-utils"
import { getNotionRichTextPlainText } from "src/libs/utils/notion/richText"
import usePostsQuery from "src/hooks/usePostsQuery"
import useSimilarPostsQuery from "src/hooks/useSimilarPostsQuery"
import { TPost } from "src/types"
import PostEgoGraph from "./PostEgoGraph"
import AdSlot from "src/components/AdSlot"
import { CONFIG } from "site.config"
import { getArticleHeadings } from "../components/NotionRenderer/headings"

type TocEntry = { id: string; text: string; level: number }

type Props = {
  recordMap: ExtendedRecordMap | null
  post: TPost
}

export const extractToc = (recordMap: ExtendedRecordMap | null): TocEntry[] => {
  return getArticleHeadings(recordMap).flatMap(({ block, level }) => {
    const text = getNotionRichTextPlainText(block.properties?.title)
    return text ? [{ id: uuidToId(block.id), text, level: level - 1 }] : []
  })
}

const RightRail = ({ recordMap, post }: Props) => {
  const [activeId, setActiveId] = useState<string>("")
  const allPosts = usePostsQuery()
  const { similar } = useSimilarPostsQuery(post.id, 5)
  const toc = useMemo(() => extractToc(recordMap), [recordMap])
  const postSlug = post.slug
  const postCategory = post.category?.[0]
  const seriesName = post.series?.[0]

  useEffect(() => {
    if (!toc.length) return

    const update = () => {
      for (const entry of [...toc].reverse()) {
        const el = document.getElementById(entry.id)
        if (el && el.getBoundingClientRect().top < 200) {
          setActiveId(entry.id)
          return
        }
      }
    }
    update()
    window.addEventListener("scroll", update, { passive: true })
    return () => window.removeEventListener("scroll", update)
  }, [toc])

  const related = useMemo(() => {
    return allPosts
      .filter(
        (p) =>
          p.slug !== postSlug &&
          p.category?.[0] === postCategory
      )
      .slice(0, 3)
  }, [allPosts, postCategory, postSlug])

  const seriesEntries = useMemo(() => {
    return seriesName
      ? allPosts.filter((p) => p.series?.includes(seriesName))
      : []
  }, [allPosts, seriesName])


  return (
    <StyledWrapper>
      <PostEgoGraph post={post} />
      {toc.length > 0 && (
        <div className="section">
          <div className="section-label">outline</div>
          {toc.map((entry) => (
            <a
              key={entry.id}
              href={`#${entry.id}`}
              className={`toc-item level-${entry.level}${activeId === entry.id ? " active" : ""}`}
              onClick={(e) => {
                e.preventDefault()
                document.getElementById(entry.id)?.scrollIntoView({ behavior: "smooth", block: "start" })
              }}
            >
              {entry.text}
            </a>
          ))}
        </div>
      )}

      {seriesEntries.length > 0 && (
        <div className="section">
          <div className="section-label">series</div>
          <Link href={`/series/${seriesName}`} className="series-title-link">
            § {seriesName}
          </Link>
          {seriesEntries.map((p) => (
            <Link
              key={p.slug}
              href={`/${p.slug}`}
              className={`related-item${p.slug === postSlug ? " current" : ""}`}
            >
              {p.slug === postSlug ? "▸ " : "· "}
              {p.title.slice(0, 30)}{p.title.length > 30 ? "…" : ""}
            </Link>
          ))}
        </div>
      )}

      {related.length > 0 && (
        <div className="section">
          <div className="section-label">related</div>
          {related.map((p) => (
            <Link key={p.slug} href={`/${p.slug}`} className="related-item">
              → {p.title.slice(0, 34)}{p.title.length > 34 ? "…" : ""}
            </Link>
          ))}
        </div>
      )}

      {similar.length > 0 && (
        <div className="section">
          <div className="section-label">ai · similar</div>
          {similar.map((s) => (
            <div key={s.postId} className="similar-item">
              <Link href={`/${s.slug}`} className="similar-title">
                → {s.title.slice(0, 34)}{s.title.length > 34 ? "…" : ""}
              </Link>
              {s.rationale && (
                <span className="similar-rationale">{s.rationale}</span>
              )}
            </div>
          ))}
        </div>
      )}

      <AdSlot
        slot={CONFIG.googleAdsense.config.slots.postRail}
        fullWidthResponsive={false}
        className="mt-6"
      />
    </StyledWrapper>
  )
}

export default RightRail
const StyledWrapper = styled.aside`
  position: sticky;
  top: ${({ theme }) => theme.variables.titleBarHeight + theme.variables.tabBarHeight}px;
  height: calc(100vh - ${({ theme }) => theme.variables.titleBarHeight + theme.variables.tabBarHeight + theme.variables.statusBarHeight}px);
  height: calc(100dvh - ${({ theme }) => theme.variables.titleBarHeight + theme.variables.tabBarHeight + theme.variables.statusBarHeight}px);
  width: 240px;
  border-left: 1px solid ${({ theme }) => theme.colors.editor.line};
  padding: 40px 18px 60px;
  background: ${({ theme }) => theme.colors.editor.bg2};
  font-family: var(--font-mono, monospace);
  overflow-y: auto;
  flex-shrink: 0;
  scrollbar-width: none;
  &::-webkit-scrollbar { display: none; }

  > .section {
    margin-bottom: 24px;
  }

  .section-label {
    font-size: 10px;
    color: ${({ theme }) => theme.colors.editor.fg3};
    letter-spacing: 1.5px;
    text-transform: uppercase;
    margin-bottom: 8px;
  }

  .toc-item {
    display: block;
    font-size: 12px;
    padding: 4px 10px;
    margin-left: -12px;
    color: ${({ theme }) => theme.colors.editor.fg3};
    border-left: 2px solid transparent;
    text-decoration: none;
    line-height: 1.5;

    &:hover { color: ${({ theme }) => theme.colors.editor.fg}; }
    &.active {
      color: ${({ theme }) => theme.colors.editor.fg};
      border-left-color: ${({ theme }) => theme.colors.editor.accent};
    }
    &.level-2 { padding-left: 20px; }
    &.level-3 { padding-left: 30px; }
    &.level-4 { padding-left: 40px; }
  }

  .series-title-link {
    display: block;
    font-size: 11px;
    font-weight: 500;
    color: ${({ theme }) => theme.colors.editor.accent};
    padding: 2px 0 6px;
    text-decoration: none;
    &:hover { opacity: 0.8; }
  }

  .related-item {
    display: block;
    font-size: 11px;
    color: ${({ theme }) => theme.colors.editor.accent3};
    padding: 3px 0;
    text-decoration: none;
    &:hover { color: ${({ theme }) => theme.colors.editor.accent}; }
    &.current {
      color: ${({ theme }) => theme.colors.editor.fg};
      font-weight: 500;
    }
  }

  .similar-item {
    margin-bottom: 8px;
  }

  .similar-title {
    display: block;
    font-size: 11px;
    color: ${({ theme }) => theme.colors.editor.accent3};
    padding: 2px 0;
    text-decoration: none;
    &:hover { color: ${({ theme }) => theme.colors.editor.accent}; }
  }

  .similar-rationale {
    display: block;
    font-size: 10px;
    color: ${({ theme }) => theme.colors.editor.fg3};
    line-height: 1.4;
    padding-left: 10px;
    opacity: 0.75;
  }


  @media (max-width: ${({ theme }) => theme.variables.breakpoint}px) {
    display: none;
  }
`
