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
import WorkbenchIcon from "src/components/WorkbenchIcon"
import FileIcon from "src/components/FileIcon"
import TabIcon from "./TabIcon"
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

type TreeItemProps = { post: TPost; isActive: boolean; href: string }

const PostTreeItem = ({ post, isActive, href }: TreeItemProps) => {
  const ref = useRef<HTMLAnchorElement>(null)
  const [showPreview, setShowPreview] = useState(false)
  const timerRef = useRef<number | undefined>(undefined)
  const { previewPost, pinTab } = useRouteChrome()
  const handleMouseEnter = useCallback(() => {
    timerRef.current = window.setTimeout(() => setShowPreview(true), 350)
  }, [])
  const handleMouseLeave = useCallback(() => {
    clearTimeout(timerRef.current)
    setShowPreview(false)
  }, [])
  useEffect(() => () => clearTimeout(timerRef.current), [])
  return <>
    <Link ref={ref} href={href} prefetch={false} className={`file-item${isActive ? " active" : ""}`} aria-current={isActive ? "page" : undefined} title={post.title} onMouseEnter={handleMouseEnter} onMouseLeave={handleMouseLeave}
      onClick={(event) => {
        if (event.metaKey || event.ctrlKey || event.altKey || event.shiftKey || event.button !== 0) return
        event.preventDefault()
        previewPost({ id: href, kind: "post", label: `${post.slug}.md`, href, closeable: true })
        if (event.detail > 1) pinTab(href)
      }} onDoubleClick={() => pinTab(href)}>
      <FileIcon name={`${post.slug}.md`} /><span className="file-name">{post.slug}.md</span>
    </Link>
    {showPreview && !isActive && <HoverPreview post={post} anchorRef={ref} />}
  </>
}

const SectionHeader = ({ label, sectionKey, isExpanded, onToggle, folder = false }: { label: string; sectionKey: string; isExpanded: boolean; onToggle: () => void; folder?: boolean }) => <button type="button" className="section-header" onClick={onToggle} aria-expanded={isExpanded} aria-controls={`tree-section-${sectionKey}`}><WorkbenchIcon name={isExpanded ? "chevron-down" : "chevron-right"} />{folder && <FileIcon name={label} folder expanded={isExpanded} />}<span>{label}</span></button>

const FileTree = () => {
  const router = useRouter()
  const posts = usePostsQuery()
  const categories = useCategoriesQuery()
  const series = useSeriesQuery()
  const activeSlug = typeof router?.query.slug === "string" ? router.query.slug : undefined
  const { expanded, toggleSection, tabs, activeTabId, closeTab, switchTab, pinTab } = useRouteChrome()
  const openEditorsRef = useRef<HTMLUListElement>(null)
  useEffect(() => {
    const list = openEditorsRef.current
    const active = list?.querySelector('[aria-current="page"]')?.closest("li")
    if (!list || !active) return
    const bounds = list.getBoundingClientRect()
    const row = active.getBoundingClientRect()
    if (row.top < bounds.top) list.scrollTop -= bounds.top - row.top
    else if (row.bottom > bounds.bottom) list.scrollTop += row.bottom - bounds.bottom
  }, [activeTabId, expanded.openEditors])
  const recentPosts = posts.slice(0, RECENT_POST_LIMIT)
  const openSlugs = new Set<string>()
  for (const tab of tabs) {
    if (tab.kind !== "post") continue
    const slug = slugFromHref(tab.href)
    if (slug) openSlugs.add(slug)
  }
  if (activeSlug) openSlugs.add(activeSlug)
  for (const post of recentPosts) openSlugs.delete(post.slug)
  const candidateSlugs = [...openSlugs]
  const openDetails = useQueries({ queries: candidateSlugs.map((slug) => queryOptions<PostDetail>({ queryKey: queryKey.post(slug), queryFn: skipToken, enabled: false })) })
  const feedBySlug = new Map(posts.map((post) => [post.slug, post]))
  const openPosts = candidateSlugs.flatMap((slug, index): TPost[] => {
    const post = feedBySlug.get(slug) ?? openDetails[index]?.data
    return !post || post.type[0] === "Page" || post.slug === CONFIG.aboutSlug ? [] : [post]
  })
  const categoryEntries = Object.entries(categories).filter(([name]) => name !== DEFAULT_CATEGORY)
  const renderPost = (post: TPost) => <PostTreeItem key={post.slug} post={post} isActive={post.slug === activeSlug} href={`/${encodeURIComponent(post.slug)}`} />
  return <StyledWrapper aria-label="Explorer">
    <header className="view-heading"><span className="workspace-name">pieroot.log</span><span className="view-title">Explorer</span></header>
    <section aria-label="Open editors" className="explorer-pane">
      <SectionHeader label="Open editors" sectionKey="open-editors" isExpanded={expanded.openEditors} onToggle={() => toggleSection("openEditors")} />
      {expanded.openEditors && <ul ref={openEditorsRef} id="tree-section-open-editors" className="open-editor-list">{tabs.map((tab) => {
        const parts = tab.label.split("/")
        const name = parts.pop() || tab.label
        const directory = parts.join("/") || (tab.kind === "post" ? "posts" : "")
        return <li key={tab.id} className={`open-editor${tab.id === activeTabId ? " active" : ""}${tab.preview ? " preview" : ""}`}>
          {tab.closeable ? <button type="button" title={`Close ${tab.label}`} aria-label={`Close ${tab.label}`} onClick={() => closeTab(tab.id)}><WorkbenchIcon name="close" size={14} /></button> : <span className="editor-action-spacer" aria-hidden="true" />}
          <Link href={tab.href} prefetch={false} title={directory ? `${directory}/${name}` : tab.label} onNavigate={() => switchTab(tab.id)} onDoubleClick={() => pinTab(tab.id)} aria-current={tab.id === activeTabId ? "page" : undefined}><TabIcon tab={tab} /><span className="editor-name">{name}</span>{directory && <span className="editor-directory">{directory}</span>}</Link>
        </li>
      })}</ul>}
    </section>
    <section aria-label="Workspace files" className="explorer-pane">
      <SectionHeader label="Files" sectionKey="workspace" isExpanded={expanded.workspace} onToggle={() => toggleSection("workspace")} />
      {expanded.workspace && <div id="tree-section-workspace" className="workspace-files">
    <SectionHeader label="posts" sectionKey="posts" folder isExpanded={expanded.posts} onToggle={() => toggleSection("posts")} />
    {expanded.posts && <div id="tree-section-posts" className="folder-contents">{[...recentPosts, ...openPosts].map(renderPost)}</div>}
    <SectionHeader label="categories" sectionKey="categories" folder isExpanded={expanded.categories} onToggle={() => toggleSection("categories")} />
    {expanded.categories && <div id="tree-section-categories" className="folder-contents">{categoryEntries.map(([name, count]) => <Link key={name} href={`/categories/${encodeURIComponent(name)}`} className="file-item"><FileIcon name={name} folder /><span className="file-name">{name}</span><span className="count">{count}</span></Link>)}</div>}
    {Object.keys(series).length > 0 && <>
      <SectionHeader label="series" sectionKey="series" folder isExpanded={expanded.series} onToggle={() => toggleSection("series")} />
      {expanded.series && <div id="tree-section-series" className="folder-contents">{Object.entries(series).map(([name, count]) => {
        const key = `series:${name}`
        const members = posts.filter((post) => post.series?.includes(name)).sort((a, b) => a.date.start_date.localeCompare(b.date.start_date))
        return <div key={name} className="series-folder">
          <button type="button" className="series-toggle" aria-expanded={!!expanded[key]} aria-controls={`series-${encodeURIComponent(name)}`} onClick={() => toggleSection(key)}><WorkbenchIcon name={expanded[key] ? "chevron-down" : "chevron-right"} /><FileIcon name={name} folder expanded={!!expanded[key]} /><span className="file-name">{name}</span><span className="count">{count}</span></button>
          {expanded[key] && <div id={`series-${encodeURIComponent(name)}`} className="series-members"><Link href={`/series/${encodeURIComponent(name)}`} className="file-item"><WorkbenchIcon name="book" /><span className="file-name">Series overview</span></Link>{members.map(renderPost)}</div>}
        </div>
      })}</div>}
    </>}
    {CONFIG.projects.length > 0 && <><SectionHeader label="projects" sectionKey="projects" folder isExpanded={expanded.projects} onToggle={() => toggleSection("projects")} />{expanded.projects && <div id="tree-section-projects" className="folder-contents">{CONFIG.projects.map((project) => <a key={project.name} href={project.href} target="_blank" rel="noopener noreferrer" className="file-item"><WorkbenchIcon name="external" /><span className="file-name">{project.name}</span></a>)}</div>}</>}
    <SectionHeader label="public" sectionKey="public" folder isExpanded={expanded.public} onToggle={() => toggleSection("public")} />
    {expanded.public && <div id="tree-section-public" className="folder-contents">{["sitemap.xml", "rss.xml"].map((name) => <a key={name} href={`/${name}`} target="_blank" rel="noopener noreferrer" className="file-item"><FileIcon name={name} /><span className="file-name">{name}</span></a>)}</div>}
    <Link href="/" className="file-item"><WorkbenchIcon name="book" /><span className="file-name">Welcome</span></Link>
    {CONFIG.aboutSlug && <Link href={`/${CONFIG.aboutSlug}`} prefetch={false} className="file-item"><FileIcon name="about.md" /><span className="file-name">about.md</span></Link>}
      </div>}
    </section>
  </StyledWrapper>
}
export default FileTree

const StyledWrapper = styled.nav`
  font-family: var(--font-ui, sans-serif);
  font-size: 12px;
  color: ${({ theme }) => theme.colors.editor.fg2};
  padding: 0 0 10px;
  .view-heading { position: sticky; top: 0; z-index: 2; display: flex; align-items: center; justify-content: space-between; gap: 8px; min-height: 42px; padding: 8px 14px; background: ${({ theme }) => theme.colors.editor.bg2}; border-bottom: 1px solid ${({ theme }) => theme.colors.editor.line}; }
  .workspace-name { min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-size: 13px; font-weight: 600; color: ${({ theme }) => theme.colors.editor.fg}; }
  .view-title { flex-shrink: 0; text-transform: uppercase; font-size: 10px; letter-spacing: .6px; color: ${({ theme }) => theme.colors.editor.fg3}; }
  .explorer-pane { border-bottom: 1px solid ${({ theme }) => theme.colors.editor.line}; }
  .explorer-pane > .section-header { text-transform: uppercase; font-size: 11px; letter-spacing: .3px; }
  .workspace-files > .section-header { padding-left: 12px; }
  .folder-contents > .file-item { padding-left: 48px; }
  button { font: inherit; cursor: pointer; border: 0; background: transparent; color: inherit; }
  button:focus-visible, a:focus-visible { outline: 1px solid ${({ theme }) => theme.colors.editor.accent}; outline-offset: -2px; }
  .section-header { display: flex; align-items: center; gap: 4px; width: 100%; min-height: 28px; padding: 3px 8px; font-weight: 600; text-align: left; }
  .file-item, .series-toggle { display: flex; align-items: center; gap: 6px; width: 100%; padding: 5px 12px 5px 32px; min-height: 28px; color: inherit; text-decoration: none; white-space: nowrap; overflow: hidden; text-align: left; }
  .file-name { overflow: hidden; text-overflow: ellipsis; flex: 1; min-width: 0; }
  svg, img { flex-shrink: 0; }
  .file-item:hover, button:hover, .active { background: ${({ theme }) => theme.colors.editor.bg3}; color: ${({ theme }) => theme.colors.editor.fg}; }
  .active { box-shadow: inset 2px 0 ${({ theme }) => theme.colors.editor.accent}; }
  .count { margin-left: auto; color: ${({ theme }) => theme.colors.editor.fg3}; }
  .series-members { border-left: 1px solid ${({ theme }) => theme.colors.editor.line}; margin-left: 48px; }
  .series-members .file-item { padding-left: 15px; }
  .series-toggle { padding-left: 32px; }
  .open-editor-list { list-style: none; padding: 0; margin: 0; max-height: min(252px, 32dvh); overflow-y: auto; overscroll-behavior-y: contain; }
  .open-editor { display: flex; align-items: center; padding: 0 8px; min-height: 28px; }
  .open-editor:hover { background: ${({ theme }) => theme.colors.editor.bg3}; }
  .open-editor a { display: flex; align-items: center; gap: 6px; flex: 1; min-width: 0; padding: 5px 4px; color: inherit; text-decoration: none; }
  .editor-name { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; min-width: 0; }
  .editor-directory { flex: 0 0 auto; min-width: 0; max-width: 40%; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-size: 11px; color: ${({ theme }) => theme.colors.editor.fg3}; }
  .open-editor button, .editor-action-spacer { flex-shrink: 0; width: 20px; height: 24px; }
  .open-editor button { display: grid; place-items: center; opacity: 0; pointer-events: none; }
  .open-editor:hover button, .open-editor:focus-within button, .open-editor.active button { opacity: 1; pointer-events: auto; }
  .preview .editor-name { font-style: italic; }
  @media (max-width: 960px), (hover: none), (pointer: coarse) { .open-editor button { opacity: 1; pointer-events: auto; } }
`
