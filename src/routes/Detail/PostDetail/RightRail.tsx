import { useEffect, useMemo, useState } from "react"
import Link from "next/link"
import styled from "@emotion/styled"
import { ExtendedRecordMap } from "notion-types"
import { uuidToId } from "notion-utils"
import { unwrapBlock } from "src/libs/utils/notion/unwrapBlock"
import usePostsQuery from "src/hooks/usePostsQuery"
import useSimilarPostsQuery from "src/hooks/useSimilarPostsQuery"
import { TPost } from "src/types"

type TocEntry = { id: string; text: string; level: number }

type Props = {
  recordMap: ExtendedRecordMap | null
  post: TPost
}

const extractToc = (recordMap: ExtendedRecordMap | null): TocEntry[] => {
  if (!recordMap) return []
  const toc: TocEntry[] = []
  for (const [id, boxed] of Object.entries(recordMap.block)) {
    const block = unwrapBlock(boxed)
    if (!block) continue
    const type = block.type
    if (type === "header" || type === "sub_header" || type === "sub_sub_header") {
      const text = block.properties?.title?.[0]?.[0] || ""
      if (text) {
        toc.push({
          id: uuidToId(id),
          text,
          level: type === "header" ? 1 : type === "sub_header" ? 2 : 3,
        })
      }
    }
  }
  return toc
}

const RightRail = ({ recordMap, post }: Props) => {
  const [activeId, setActiveId] = useState<string>("")
  const allPosts = usePostsQuery()
  const { similar } = useSimilarPostsQuery(post.id, 5)
  const toc = useMemo(() => extractToc(recordMap), [recordMap])
  const postTags = useMemo(() => post.tags || [], [post.tags])
  const postSlug = post.slug
  const postCategory = post.category?.[0]
  const seriesName = post.series?.[0]
  const normalizedPostTags = useMemo(
    () => [...new Set(postTags)],
    [postTags]
  )

  useEffect(() => {
    const scrollEl = document.querySelector(".scroll-area")
    if (!scrollEl || !toc.length) return

    const update = () => {
      for (const entry of [...toc].reverse()) {
        const el = document.getElementById(entry.id)
        if (el && el.getBoundingClientRect().top < 200) {
          setActiveId(entry.id)
          return
        }
      }
    }
    scrollEl.addEventListener("scroll", update, { passive: true })
    return () => scrollEl.removeEventListener("scroll", update)
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

  const nodes = useMemo(() => {
    return allPosts
      .filter((p) => p.slug !== postSlug)
      .map((p) => ({
        slug: p.slug,
        title: p.title,
        tags: p.tags || [],
        shared: (p.tags || []).filter((t) => normalizedPostTags.includes(t)).length,
      }))
      .filter((n) => n.shared > 0)
      .slice(0, 5)
  }, [allPosts, normalizedPostTags, postSlug])

  return (
    <StyledWrapper>
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

      {nodes.length > 0 && postSlug !== "about" && (
        <div className="section">
          <div className="section-label">graph</div>
          <div className="mini-graph">
            <svg viewBox="0 0 200 110" width="100%" height="100%">
              <title>{post.title}</title>
              {nodes.map((n, i) => {
                const angle = (i / nodes.length) * Math.PI * 2
                const x = Math.round((100 + Math.cos(angle) * 65) * 100) / 100
                const y = Math.round((55 + Math.sin(angle) * 40) * 100) / 100
                return (
                  <g key={n.slug}>
                    <line
                      x1={100} y1={55} x2={x} y2={y}
                      stroke="currentColor" strokeWidth={n.shared * 0.6}
                      style={{ color: "var(--line2, #cfcbb8)", opacity: 0.6 }}
                    />
                    <a href={`/${n.slug}`} style={{ cursor: "pointer" }}>
                      <title>{n.title}</title>
                      <circle cx={x} cy={y} r={5} className="graph-node" style={{ fill: "var(--fg3, #888a80)" }} />
                    </a>
                  </g>
                )
              })}
              <circle cx={100} cy={55} r={7} style={{ fill: "var(--accent, #ee5a1c)" }} />
            </svg>
          </div>
        </div>
      )}
    </StyledWrapper>
  )
}

export default RightRail
const StyledWrapper = styled.aside`
  position: sticky;
  top: 0;
  height: 100vh;
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

  .mini-graph {
    height: 110px;
    border: 1px solid ${({ theme }) => theme.colors.editor.line};
    background: ${({ theme }) => theme.colors.editor.bg};
    color: ${({ theme }) => theme.colors.editor.line2};

    --line2: ${({ theme }) => theme.colors.editor.line2};
    --fg3: ${({ theme }) => theme.colors.editor.fg3};
    --accent: ${({ theme }) => theme.colors.editor.accent};

    .graph-node {
      transition: fill 0.15s ease, r 0.15s ease;
    }
    a:hover .graph-node {
      fill: var(--accent) !important;
    }
  }

  @media (max-width: ${({ theme }) => theme.variables.breakpoint}px) {
    display: none;
  }
`
