import { useEffect, useRef, useState, useCallback } from "react"
import Link from "next/link"
import { useRouter } from "next/router"
import styled from "@emotion/styled"
import usePostsQuery from "src/hooks/usePostsQuery"
import { useCategoriesQuery } from "src/hooks/useCategoriesQuery"
import { useSeriesQuery } from "src/hooks/useSeriesQuery"
import { CONFIG } from "site.config"
import { DEFAULT_CATEGORY } from "src/constants"
import { useRouteChrome } from "./RouteChromeContext"
import type { TPost } from "src/types"

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
      top: rect.top + window.scrollY,
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
      <a
        ref={ref}
        href={href}
        className={`file-item${isActive ? " active" : ""}`}
        title={post.title}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
      >
        <span className="file-icon">◧</span>
        <span className="file-name">{post.slug.slice(0, 22)}.md</span>
      </a>
      {showPreview && <HoverPreview post={post} anchorRef={ref} />}
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
  const activeSlug = router.query.slug as string | undefined
  const { isFileTreeOpen, expanded, toggleSection } = useRouteChrome()

  const recentPosts = posts.slice(0, 15)
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
          {recentPosts.map((p) => (
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
        className={`file-item${router.pathname === "/" ? " active" : ""}`}
      >
        <span className="file-name">  README.md</span>
      </Link>
      <Link
        href="/about"
        className={`file-item${router.asPath === "/about" ? " active" : ""}`}
      >
        <span className="file-name">  about.md</span>
      </Link>
    </StyledWrapper>
  )
}

export default FileTree

const StyledWrapper = styled.nav`
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
  transition: margin-left 0.18s ease, transform 0.18s ease;
  will-change: margin-left, transform;

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

    .chev {
      display: inline-block;
      width: 10px;
    }

    &:hover {
      color: ${({ theme }) => theme.colors.editor.fg};
    }
  }

  .spacer {
    height: 8px;
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
    position: absolute;
    top: 0;
    left: ${({ theme }) => theme.variables.activityBarWidth}px;
    bottom: 0;
    width: min(280px, calc(100% - ${({ theme }) => theme.variables.activityBarWidth}px));
    z-index: 20;
    box-shadow: 4px 0 16px rgba(0, 0, 0, 0.45);
    margin-left: 0;
    transform: translateX(0);

    &.closed {
      margin-left: 0;
      transform: translateX(-100%);
      box-shadow: none;
    }
  }
`
