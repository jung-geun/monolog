import { useEffect, useRef, useState, useCallback } from "react"
import Link from "next/link"
import { useRouter } from "next/compat/router"
import styled from "@emotion/styled"
import { queryOptions, skipToken, useQueries } from "@tanstack/react-query"
import usePostsQuery from "src/hooks/usePostsQuery"
import { useCategoriesQuery } from "src/hooks/useCategoriesQuery"
import { useSeriesQuery } from "src/hooks/useSeriesQuery"
import { CONFIG } from "site.config"
import { DEFAULT_CATEGORY } from "src/constants"
import { queryKey } from "src/constants/queryKey"
import { useRouteChrome } from "./RouteChromeContext"
import type { PostDetail, TPost } from "src/types"

const RECENT_POST_LIMIT = 15

// A post document lives at a single-segment path (`/<slug>`); hash and query
// belong to the tab's location, not to the document identity.
const slugFromHref = (href: string): string | undefined => {
  const match = /^\/([^/?#]+)(?:[?#]|$)/.exec(href)
  if (!match) return undefined
  try {
    return decodeURIComponent(match[1])
  } catch {
    return match[1]
  }
}

// ---------------------------------------------------------------------------
// Hover preview tooltip
// ---------------------------------------------------------------------------

type PreviewProps = {
  post: TPost
  anchorRef: React.RefObject<HTMLElement | null>
}

const HoverPreview = ({ post, anchorRef }: PreviewProps) => {
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null)

  useEffect(() => {
    const el = anchorRef.current
    if (!el) return
    const rect = el.getBoundingClientRect()
    setPos({
      top: rect.top,
      left: rect.right + 8,
    })
  }, [anchorRef])

  if (!pos) return null

  return (
    <PreviewCard style={{ top: pos.top, left: pos.left }}>
      <div className="preview-title">{post.title}</div>
      {post.category && post.category.length > 0 && (
        <div className="preview-meta">{post.category[0]}</div>
      )}
      {post.date?.start_date && (
        <div className="preview-date">{post.date.start_date}</div>
      )}
      {post.summary && <div className="preview-summary">{post.summary}</div>}
    </PreviewCard>
  )
}

const PreviewCard = styled.div`
  position: fixed;
  z-index: 200;
  width: 280px;
  background: ${({ theme }) => theme.colors.editor.bg2};
  border: 1px solid ${({ theme }) => theme.colors.editor.line};
  border-radius: 6px;
  padding: 12px 14px;
  pointer-events: none;
  transform-origin: top left;
  animation: monolog-panel-enter 180ms var(--motion-ease);

  @media (prefers-reduced-motion: reduce) { animation: none; }

  .preview-title {
    font-size: 12px;
    font-weight: 600;
    color: ${({ theme }) => theme.colors.editor.fg};
    margin-bottom: 6px;
    overflow: hidden;
    display: -webkit-box;
    -webkit-line-clamp: 2;
    -webkit-box-orient: vertical;
  }
  .preview-meta {
    font-size: 11px;
    color: ${({ theme }) => theme.colors.editor.accent};
    margin-bottom: 2px;
  }
  .preview-date {
    font-size: 11px;
    color: ${({ theme }) => theme.colors.editor.fg3};
    margin-bottom: 6px;
  }
  .preview-summary {
    font-size: 11px;
    color: ${({ theme }) => theme.colors.editor.fg2};
    overflow: hidden;
    display: -webkit-box;
    -webkit-line-clamp: 3;
    -webkit-box-orient: vertical;
    line-height: 1.5;
  }
`

// ---------------------------------------------------------------------------
// Tree item with hover preview
// ---------------------------------------------------------------------------

type TreeItemProps = {
  post: TPost
  isActive: boolean
  href: string
}

const PostTreeItem = ({ post, isActive, href }: TreeItemProps) => {
  const ref = useRef<HTMLAnchorElement>(null)
  const [showPreview, setShowPreview] = useState(false)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const handleMouseEnter = useCallback(() => {
    timerRef.current = setTimeout(() => setShowPreview(true), 350)
  }, [])

  const handleMouseLeave = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current)
    setShowPreview(false)
  }, [])

  return (
    <>
      <Link
        ref={ref}
        href={href}
        className={`file-item${isActive ? " active" : ""}`}
        aria-current={isActive ? "page" : undefined}
        title={post.title}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
      >
        <span className="file-icon">◧</span>
        <span className="file-name">{post.slug.slice(0, 22)}.md</span>
      </Link>
      {showPreview && !isActive && <HoverPreview post={post} anchorRef={ref} />}
    </>
  )
}

// ---------------------------------------------------------------------------
// Section header
// ---------------------------------------------------------------------------

type SectionHeaderProps = {
  label: string
  sectionKey: string
  isExpanded: boolean
  onToggle: () => void
}

const SectionHeader = ({ label, sectionKey, isExpanded, onToggle }: SectionHeaderProps) => (
  <button
    className="section-header"
    onClick={onToggle}
    aria-expanded={isExpanded}
    aria-controls={`tree-section-${sectionKey}`}
  >
    <span className="chev">{isExpanded ? "▾" : "▸"}</span> {label}
  </button>
)

// ---------------------------------------------------------------------------
// FileTree
// ---------------------------------------------------------------------------

const FileTree = () => {
  const router = useRouter()
  const posts = usePostsQuery()
  const categories = useCategoriesQuery()
  const series = useSeriesQuery()
  const activeSlug = typeof router?.query.slug === "string" ? router.query.slug : undefined
  const { isFileTreeOpen, expanded, toggleSection, tabs } = useRouteChrome()

  const recentPosts = posts.slice(0, RECENT_POST_LIMIT)
  // Open documents outside the recent list, in tab order, plus the current
  // document. Whether each is a post is decided by metadata, not by its tab.
  const openSlugs = new Set<string>()
  for (const tab of tabs) {
    const slug = slugFromHref(tab.href)
    if (slug) openSlugs.add(slug)
  }
  if (activeSlug) openSlugs.add(activeSlug)
  for (const post of recentPosts) openSlugs.delete(post.slug)
  const candidateSlugs = [...openSlugs]
  // Observing the hydrated detail of each open document keeps its metadata
  // cached while the tab stays open, so detail-only posts (absent from the
  // feed) remain listed after switching tabs. Closing the tab drops the observer.
  const openDetails = useQueries({
    queries: candidateSlugs.map((slug) =>
      queryOptions<PostDetail>({ queryKey: queryKey.post(slug), queryFn: skipToken, enabled: false })
    ),
  })
  const feedBySlug = new Map(posts.map((post) => [post.slug, post]))
  const openPosts = candidateSlugs.flatMap((slug, index): TPost[] => {
    const post = feedBySlug.get(slug) ?? openDetails[index]?.data
    if (!post || post.type[0] === "Page") return []
    if (CONFIG.aboutSlug && post.slug === CONFIG.aboutSlug) return []
    return [post]
  })
  const categoryEntries = Object.entries(categories).filter(
    ([name]) => name !== DEFAULT_CATEGORY
  )

  return (
    <StyledWrapper className={isFileTreeOpen ? "open" : "closed"}>
      <div className="workspace-label">pieroot.log</div>

      {/* posts/ */}
      <SectionHeader
        label="posts/"
        sectionKey="posts"
        isExpanded={expanded.posts}
        onToggle={() => toggleSection("posts")}
      />
      {expanded.posts && (
        <div id="tree-section-posts">
          {[...recentPosts, ...openPosts].map((p) => (
            <PostTreeItem
              key={p.slug}
              post={p}
              isActive={p.slug === activeSlug}
              href={`/${p.slug}`}
            />
          ))}
        </div>
      )}

      {/* categories/ */}
      <SectionHeader
        label="categories/"
        sectionKey="categories"
        isExpanded={expanded.categories}
        onToggle={() => toggleSection("categories")}
      />
      {expanded.categories && (
        <div id="tree-section-categories">
          {categoryEntries.map(([name, count]) => (
            <Link
              key={name}
              href={`/categories/${name}`}
              className="file-item category"
            >
              <span className="cat-hash">#</span>
              <span className="cat-name">{name}</span>
              <span className="cat-count">{count}</span>
            </Link>
          ))}
        </div>
      )}

      {/* series/ */}
      {Object.keys(series).length > 0 && (
        <>
          <SectionHeader
            label="series/"
            sectionKey="series"
            isExpanded={expanded.series}
            onToggle={() => toggleSection("series")}
          />
          {expanded.series && (
            <div id="tree-section-series">
              {Object.entries(series).map(([name, count]) => (
                <Link
                  key={name}
                  href={`/series/${name}`}
                  className="file-item category"
                >
                  <span className="cat-hash">§</span>
                  <span className="cat-name">{name}</span>
                  <span className="cat-count">{count}</span>
                </Link>
              ))}
            </div>
          )}
        </>
      )}

      {/* projects/ */}
      {CONFIG.projects.length > 0 && (
        <>
          <SectionHeader
            label="projects/"
            sectionKey="projects"
            isExpanded={expanded.projects}
            onToggle={() => toggleSection("projects")}
          />
          {expanded.projects && (
            <div id="tree-section-projects">
              {CONFIG.projects.map((p) => (
                <a
                  key={p.name}
                  href={p.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="file-item"
                  title={p.name}
                >
                  <span className="file-icon">⇗</span>
                  <span className="file-name">{p.name.slice(0, 22)}</span>
                </a>
              ))}
            </div>
          )}
        </>
      )}

      {/* drafts/ */}
      <SectionHeader
        label="drafts/"
        sectionKey="drafts"
        isExpanded={expanded.drafts}
        onToggle={() => toggleSection("drafts")}
      />
      {expanded.drafts && (
        <div id="tree-section-drafts">
          <span className="file-item static">
            <span className="file-name">비공개 포스트 없음</span>
          </span>
        </div>
      )}

      {/* public/ */}
      <SectionHeader
        label="public/"
        sectionKey="public"
        isExpanded={expanded.public}
        onToggle={() => toggleSection("public")}
      />
      {expanded.public && (
        <div id="tree-section-public">
          <a
            href="/sitemap.xml"
            target="_blank"
            rel="noopener noreferrer"
            className="file-item"
          >
            <span className="file-icon">◈</span>
            <span className="file-name">sitemap.xml</span>
          </a>
          <a
            href="/rss.xml"
            target="_blank"
            rel="noopener noreferrer"
            className="file-item"
          >
            <span className="file-icon">◈</span>
            <span className="file-name">rss.xml</span>
          </a>
        </div>
      )}

      {/* static links */}
      <div className="spacer" />
      <Link
        href="/"
        className={`file-item${router?.pathname === "/" ? " active" : ""}`}
      >
        <span className="file-name">  README.md</span>
      </Link>
      <Link
        href={`/${CONFIG.aboutSlug}`}
        className={`file-item${router?.asPath === `/${CONFIG.aboutSlug}` ? " active" : ""}`}
      >
        <span className="file-name">  about.md</span>
      </Link>
    </StyledWrapper>
  )
}

export default FileTree

const StyledWrapper = styled.nav`
  position: sticky;
  top: ${({ theme }) => theme.variables.titleBarHeight}px;
  height: calc(100vh - ${({ theme }) => theme.variables.titleBarHeight + theme.variables.statusBarHeight}px);
  height: calc(100dvh - ${({ theme }) => theme.variables.titleBarHeight + theme.variables.statusBarHeight}px);
  align-self: flex-start;
  width: ${({ theme }) => theme.variables.fileTreeWidth}px;
  background: ${({ theme }) => theme.colors.editor.bg2};
  border-right: 1px solid ${({ theme }) => theme.colors.editor.line};
  font-family: var(--font-mono, monospace);
  font-size: 12px;
  color: ${({ theme }) => theme.colors.editor.fg2};
  overflow-y: auto;
  overflow-x: hidden;
  padding: 10px 0;
  flex-shrink: 0;
  margin-left: 0;
  transition: margin-left 240ms var(--motion-ease), transform 240ms var(--motion-ease);

  scrollbar-width: none;
  &::-webkit-scrollbar { display: none; }

  .workspace-label {
    padding: 0 12px 8px;
    font-size: 10px;
    color: ${({ theme }) => theme.colors.editor.fg3};
    letter-spacing: 1.2px;
    text-transform: uppercase;
  }

  .section-header {
    all: unset;
    display: block;
    width: 100%;
    box-sizing: border-box;
    padding: 2px 12px;
    color: ${({ theme }) => theme.colors.editor.fg3};
    cursor: pointer;
    margin-top: 6px;
    user-select: none;
    transition: color var(--motion-fast);

    &:focus-visible {
      outline: 1px solid ${({ theme }) => theme.colors.editor.accent};
      outline-offset: -2px;
    }

    &:active .chev { transform: scale(0.8); }

    .chev {
      display: inline-block;
      width: 10px;
      transition: transform var(--motion-fast) var(--motion-ease);
    }

    &:hover {
      color: ${({ theme }) => theme.colors.editor.fg};
    }
  }

  .spacer {
    height: 8px;
  }

  [id^="tree-section-"] {
    animation: monolog-menu-enter 200ms var(--motion-ease);
  }

  .file-item {
    display: flex;
    align-items: center;
    padding: 5px 12px 5px 26px;
    color: ${({ theme }) => theme.colors.editor.fg2};
    background: transparent;
    border-left: 2px solid transparent;
    margin-left: -2px;
    cursor: pointer;
    white-space: nowrap;
    overflow: hidden;
    text-decoration: none;
    gap: 6px;
    transition: background var(--motion-fast), color var(--motion-fast);

    &:focus-visible {
      outline: 1px solid ${({ theme }) => theme.colors.editor.accent};
      outline-offset: -2px;
    }

    &:active .file-icon { transform: scale(0.85); }

    &:hover {
      background: ${({ theme }) => theme.colors.editor.bg3};
      color: ${({ theme }) => theme.colors.editor.fg};
    }

    &.active {
      background: ${({ theme }) => theme.colors.editor.bg3};
      color: ${({ theme }) => theme.colors.editor.fg};
      border-left-color: ${({ theme }) => theme.colors.editor.accent};
    }

    &.static {
      color: ${({ theme }) => theme.colors.editor.fg3};
      cursor: default;
      &:hover { background: transparent; color: ${({ theme }) => theme.colors.editor.fg3}; }
    }

    &.category {
      justify-content: space-between;
    }

    .file-icon {
      color: ${({ theme }) => theme.colors.editor.accent2};
      flex-shrink: 0;
      transition: transform var(--motion-fast) var(--motion-ease);
    }
    .file-name {
      overflow: hidden;
      text-overflow: ellipsis;
    }
    .cat-hash { color: ${({ theme }) => theme.colors.editor.fg3}; flex-shrink: 0; }
    .cat-name { flex: 1; overflow: hidden; text-overflow: ellipsis; }
    .cat-count { color: ${({ theme }) => theme.colors.editor.fg3}; flex-shrink: 0; margin-left: 8px; }
  }

  &.closed {
    margin-left: -${({ theme }) => theme.variables.fileTreeWidth}px;
    pointer-events: none;
  }

  @media (max-width: ${({ theme }) => theme.variables.breakpoint}px) {
    position: fixed;
    top: ${({ theme }) => theme.variables.titleBarHeight}px;
    left: ${({ theme }) => theme.variables.activityBarWidth}px;
    bottom: ${({ theme }) => theme.variables.statusBarHeight}px;
    width: min(280px, calc(100% - ${({ theme }) => theme.variables.activityBarWidth}px));
    z-index: 45;
    box-shadow: 4px 0 16px rgba(0, 0, 0, 0.45);
    margin-left: 0;
    transform: translateX(0);

    &.closed {
      margin-left: 0;
      transform: translateX(-100%);
      box-shadow: none;
    }
  }

  @media (prefers-reduced-motion: reduce) {
    transition: none;
    [id^="tree-section-"] { animation: none; }
    .section-header:active .chev,
    .file-item:active .file-icon { transform: none; }
  }
`
