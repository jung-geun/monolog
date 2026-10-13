import { useEffect, useMemo, useRef, useState } from "react"
import styled from "@emotion/styled"
import dynamic from "next/dynamic"
import Image from "next/image"
import Link from "next/link"
import usePostQuery from "src/hooks/usePostQuery"
import usePostsQuery from "src/hooks/usePostsQuery"
import NotionRenderer from "../components/NotionRenderer"
import Footer from "./PostFooter"
import SeriesNav from "./SeriesNav"
import Frontmatter from "src/components/Frontmatter"
import ReadingProgress from "./ReadingProgress"
import RightRail, { extractToc } from "./RightRail"
import MarkdownActions from "./MarkdownActions"
import DocumentPanel from "./DocumentPanel"
import { useRegisterChrome } from "src/layouts/RootLayout/EditorChrome/RouteChromeContext"
import { useWorkbench } from "src/layouts/RootLayout/EditorChrome/WorkbenchContext"
import type { DocumentMode } from "src/layouts/RootLayout/EditorChrome/WorkbenchContext"
import WorkbenchIcon from "src/components/WorkbenchIcon"
import AdSlot from "src/components/AdSlot"
import { CONFIG } from "site.config"
import ActivityHeatmap from "src/routes/Detail/PageDetail/components/ActivityHeatmap"
import GitHubContributions from "src/routes/Detail/PageDetail/components/GitHubContributions"
import ContactBlock from "src/routes/Detail/PageDetail/components/ContactBlock"
import StackGrid from "src/routes/Detail/PageDetail/components/StackGrid"
import StatsGrid from "src/routes/Feed/StatsGrid"
import { getStats } from "src/libs/utils/stats"
import { publishedDate, modifiedDate, calendarDate, summaryText } from "src/libs/seo"
import { getArticleDescription } from "src/libs/utils/notion/articleSummary"

const MarkdownSource = dynamic(() => import("./MarkdownSource"), { loading: () => <p role="status" className="source-loading">Loading source viewer…</p> })
const modes: { id: DocumentMode; label: string; icon: "preview" | "code" | "split" }[] = [{ id: "preview", label: "Preview", icon: "preview" }, { id: "source", label: "Source", icon: "code" }, { id: "split", label: "Split", icon: "split" }]

const PostDetail = () => {
  const data = usePostQuery()
  const allPosts = usePostsQuery()
  const { documentMode, setDocumentMode, setDocumentContext, isSecondaryOpen, setSecondaryOpen, isPanelOpen, setPanelOpen, panelTab, setPanelTab, readingMode, setReadingMode } = useWorkbench()
  const [mobilePane, setMobilePane] = useState<"preview" | "source">("preview")
  const [syncScroll, setSyncScroll] = useState(true)
  const panes = useRef<HTMLDivElement>(null)
  const headings = useMemo(() => extractToc(data?.recordMap ?? null).map(heading => ({ ...heading, level: heading.level + 1 })), [data?.recordMap])
  const isAbout = Boolean(CONFIG.aboutSlug) && data?.slug === CONFIG.aboutSlug
  const isPage = data?.type[0] === "Page"
  const filename = data ? `${data.slug}.md` : ""
  const statusItems = useMemo(() => ["main", documentMode === "preview" ? "Markdown Preview" : documentMode === "source" ? "Read-only" : "Split Preview", "Markdown"], [documentMode])
  useRegisterChrome(filename, statusItems, isAbout ? "about" : isPage ? "page" : "post")

  useEffect(() => {
    setDocumentContext(data ? { slug: data.slug, title: data.title, headings } : null)
    return () => setDocumentContext(null)
  }, [data, headings, setDocumentContext])

  useEffect(() => {
    if (documentMode !== "split" || !syncScroll) return
    const preview = panes.current?.querySelector<HTMLElement>(".document-preview")
    const source = panes.current?.querySelector<HTMLElement>(".document-source")
    if (!preview || !source) return
    let locked: HTMLElement | null = null
    let releaseFrame = 0
    const synchronize = (origin: HTMLElement, target: HTMLElement, fromSource: boolean) => {
      if (locked === origin || !window.matchMedia("(min-width: 961px)").matches) return
      const top = origin.getBoundingClientRect().top + 100
      const candidates = fromSource ? Array.from(origin.querySelectorAll<HTMLElement>("[data-source-heading]")) : headings.map(heading => document.getElementById(heading.id)).filter((element): element is HTMLElement => Boolean(element))
      let current: HTMLElement | undefined
      for (const element of candidates) {
        if (element.getBoundingClientRect().top <= top) current = element
        else break
      }
      if (!current) return
      const id = fromSource ? current.dataset.sourceHeading : current.id
      const destination = fromSource ? (id ? document.getElementById(id) : null) : Array.from(target.querySelectorAll<HTMLElement>("[data-source-heading]")).find(element => element.dataset.sourceHeading === id)
      if (!destination) return
      const offset = destination.getBoundingClientRect().top - target.getBoundingClientRect().top + target.scrollTop - 70
      if (Math.abs(target.scrollTop - offset) < 2) return
      locked = target
      target.scrollTop = Math.max(0, offset)
      cancelAnimationFrame(releaseFrame)
      releaseFrame = requestAnimationFrame(() => { releaseFrame = requestAnimationFrame(() => { locked = null }) })
    }
    const fromPreview = () => synchronize(preview, source, false)
    const fromSource = () => synchronize(source, preview, true)
    preview.addEventListener("scroll", fromPreview, { passive: true })
    source.addEventListener("scroll", fromSource, { passive: true })
    return () => { cancelAnimationFrame(releaseFrame); preview.removeEventListener("scroll", fromPreview); source.removeEventListener("scroll", fromSource) }
  }, [documentMode, headings, syncScroll])

  if (!data) return null
  const category = data.category?.[0]
  const published = publishedDate(data)
  const modified = modifiedDate(data)
  const meaningfulModified = modified && published && modified > published && calendarDate(modified) !== calendarDate(published) ? modified : undefined
  const authors = data.author?.map(author => author.name.trim()).filter(Boolean)
  const summary = getArticleDescription(summaryText(data.summary), data.recordMap, data.id)
  const openPanel = (tab: "references" | "comments") => { setPanelTab(tab); setPanelOpen(true); setReadingMode(false); requestAnimationFrame(() => document.getElementById("document-bottom-panel")?.scrollIntoView({ block: "start" })) }

  return <Workspace className={`post-detail${readingMode ? " reading-mode" : ""}`}>
    <ReadingProgress />
    <div className="document-toolbar">
      <nav className="breadcrumbs" aria-label="Breadcrumbs"><Link href="/">monolog</Link><WorkbenchIcon name="chevron-right" size={12} />{category && <><Link href={`/search?q=${encodeURIComponent(`category:${JSON.stringify(category)}`)}`}>{category}</Link><WorkbenchIcon name="chevron-right" size={12} /></>}<span title={filename}>{filename}</span></nav>
      <div className="document-controls">
        <div className="mode-switch" aria-label="Document view">{modes.map(mode => <button type="button" key={mode.id} aria-label={mode.label} title={mode.label} aria-pressed={documentMode === mode.id} onClick={() => setDocumentMode(mode.id)}><WorkbenchIcon name={mode.icon} /><span>{mode.label}</span></button>)}</div>
        <button type="button" title="Reading mode" aria-label="Reading mode" aria-pressed={readingMode} onClick={() => setReadingMode(!readingMode)}><WorkbenchIcon name="book" /></button>
        <button type="button" title="Toggle outline and series" aria-label="Toggle outline and series" aria-pressed={isSecondaryOpen && !readingMode} onClick={() => { setSecondaryOpen(!isSecondaryOpen || readingMode); setReadingMode(false) }}><WorkbenchIcon name="layout-right" /></button>
        <button type="button" title="Toggle references and comments" aria-label="Toggle references and comments" aria-pressed={isPanelOpen && !readingMode} onClick={() => { setPanelOpen(!isPanelOpen || readingMode); setReadingMode(false) }}><WorkbenchIcon name="layout-panel" /></button>
        <MarkdownActions slug={data.slug} />
      </div>
    </div>
    {documentMode === "split" && <div className="split-options"><label><input type="checkbox" checked={syncScroll} onChange={event => setSyncScroll(event.target.checked)} /> Synchronize matched headings</label><span>Exported Markdown is not an exact Notion line map.</span><div className="mobile-pane-switch"><button type="button" aria-pressed={mobilePane === "preview"} onClick={() => setMobilePane("preview")}>Preview</button><button type="button" aria-pressed={mobilePane === "source"} onClick={() => setMobilePane("source")}>Source</button></div></div>}
    <div className={`document-grid${isSecondaryOpen && !readingMode ? " with-rail" : ""}`}>
      <div className="document-main">
        <div ref={panes} className={`document-panes document-panes--${documentMode} mobile-pane--${mobilePane}`}>
          <div className="document-preview" hidden={documentMode === "source"}>
            <article className={`body${isAbout ? " about-body" : ""}`}>
              <header><div className="preview-label">Markdown Preview</div><h1 className="post-title">{data.title}</h1><Frontmatter title={data.title} date={published} modifiedDate={meaningfulModified} authors={authors} category={category} tags={data.tags} /></header>
              {summary && !isAbout && <p className="post-summary">{summary}</p>}
              {data.thumbnail && !isAbout && <div className="hero-thumb"><Image src={data.thumbnail} alt={data.title} fill sizes="(max-width: 960px) 100vw, 760px" className="object-cover" /></div>}
              {isAbout && <div className="about-sections"><p className="profile-bio">{CONFIG.profile.role}{CONFIG.profile.bio ? ` · ${CONFIG.profile.bio}` : ""}</p><details open><summary>Writing & activity</summary><StatsGrid stats={getStats(allPosts)} /><ActivityHeatmap /><GitHubContributions username={CONFIG.profile.github} /></details><details><summary>Tools & technologies</summary><StackGrid /></details><details open><summary>Contact</summary><ContactBlock /></details></div>}
              <div className="notion-content"><NotionRenderer recordMap={data.recordMap} /></div>
              {!isPage && !isAbout && <AdSlot slot={CONFIG.googleAdsense.config.slots.postBottom} className="my-8" />}
              <SeriesNav post={data} allPosts={allPosts} />
              <nav className="document-context-links" aria-label="Article context"><button type="button" onClick={() => openPanel("references")}><WorkbenchIcon name="link" />References & similar articles</button><button type="button" onClick={() => openPanel("comments")}><WorkbenchIcon name="comment" />Comments</button></nav>
              <Footer />
            </article>
          </div>
          {documentMode !== "preview" && <div className="document-source"><MarkdownSource key={data.slug} slug={data.slug} headings={headings} /></div>}
        </div>
      </div>
      <RightRail recordMap={data.recordMap} post={data} />
    </div>
    <div id="document-bottom-panel"><DocumentPanel key={data.slug} post={data} /></div>
    {isPanelOpen && !readingMode && <div className="panel-footer-label">{panelTab === "references" ? "References" : "Comments"} · {filename}</div>}
  </Workspace>
}

export default PostDetail
const Workspace = styled.div`
  min-width: 0;
  min-height: 100%;
  .document-toolbar { position: sticky; top: 0; z-index: 12; display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 4px 12px; min-height: 40px; padding: 4px 12px; border-bottom: 1px solid ${({ theme }) => theme.colors.editor.line}; background: ${({ theme }) => theme.colors.editor.bg}; }
  .breadcrumbs { display: flex; gap: 6px; align-items: center; min-width: 0; flex: 1; font-size: 11px; color: ${({ theme }) => theme.colors.editor.fg3}; }
  .breadcrumbs a { color: inherit; text-decoration: none; white-space: nowrap; }
  .breadcrumbs span { text-overflow: ellipsis; overflow: hidden; white-space: nowrap; }
  .document-controls, .mode-switch { display: flex; align-items: center; gap: 2px; }
  .document-controls > button, .mode-switch button, .mobile-pane-switch button { display: inline-flex; align-items: center; gap: 5px; border: 0; background: transparent; color: ${({ theme }) => theme.colors.editor.fg3}; padding: 6px; font-size: 11px; cursor: pointer; }
  .document-controls button:hover, .document-controls button[aria-pressed="true"], .mobile-pane-switch button[aria-pressed="true"] { background: ${({ theme }) => theme.colors.editor.line}; color: ${({ theme }) => theme.colors.editor.fg}; }
  button:focus-visible, a:focus-visible, summary:focus-visible { outline: 2px solid ${({ theme }) => theme.colors.editor.accent}; outline-offset: 2px; }
  .document-controls .split-button { border: 0; border-radius: 0; background: none; }
  .document-controls .split-button button, .document-controls .split-button summary { width: 28px; height: 28px; border: 0; }
  .document-grid { display: grid; grid-template-columns: minmax(0, 1fr); }
  .document-grid.with-rail { grid-template-columns: minmax(0, 1fr) 224px; }
  .document-main, .document-panes, .document-preview, .document-source { min-width: 0; }
  .document-preview[hidden] { display: none; }
  .document-panes--split { display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 1fr); height: calc(100dvh - 190px); min-height: 360px; }
  .document-panes--split .document-preview, .document-panes--split .document-source { overflow: auto; }
  .document-source { border-left: 1px solid ${({ theme }) => theme.colors.editor.line}; }
  .document-panes--source .document-source { border-left: 0; }
  .split-options { display: flex; align-items: center; flex-wrap: wrap; gap: 8px 18px; padding: 6px 16px; border-bottom: 1px solid ${({ theme }) => theme.colors.editor.line}; color: ${({ theme }) => theme.colors.editor.fg3}; font-size: 10px; }
  .split-options label { display: inline-flex; align-items: center; gap: 6px; }
  .split-options input[type="checkbox"] { appearance: auto; width: 13px; height: 13px; accent-color: ${({ theme }) => theme.colors.editor.accent}; }
  .mobile-pane-switch { display: none; }
  .body { width: 100%; max-width: 800px; margin: 0 auto; padding: 30px 44px 40px; overflow-wrap: anywhere; }
  .document-panes--split .body { padding: 24px; }
  .preview-label { font-family: var(--font-mono, monospace); font-size: 10px; color: ${({ theme }) => theme.colors.editor.fg3}; margin-bottom: 12px; }
  .post-title { font-family: var(--font-sans, system-ui, sans-serif); font-size: clamp(26px, 3vw, 36px); font-weight: 650; margin: 0 0 14px; line-height: 1.3; letter-spacing: -0.035em; color: ${({ theme }) => theme.colors.editor.fg}; text-wrap: balance; }
  .post-summary { color: ${({ theme }) => theme.colors.editor.fg2}; line-height: 1.8; white-space: pre-wrap; font-size: 15px; margin: 0 0 24px; }
  .hero-thumb { position: relative; width: 100%; aspect-ratio: 21 / 9; max-height: 260px; overflow: hidden; margin-bottom: 28px; background: ${({ theme }) => theme.colors.editor.bg2}; }
  .notion-content { font-size: 16px; line-height: 1.85; }
  .notion-content .notion-page { padding: 0 !important; width: 100%; }
  .notion-content :is(h2, h3, h4, h5) { scroll-margin-top: 72px; }
  .notion-content code:not(pre code), .notion-content .notion-inline-code { background: ${({ theme }) => theme.colors.editor.bg2}; color: ${({ theme }) => theme.colors.editor.accent}; border-radius: 3px; padding: 2px 5px; font-family: var(--font-mono, monospace); }
  .about-sections { margin-bottom: 24px; }
  .about-sections > details { border-bottom: 1px solid ${({ theme }) => theme.colors.editor.line}; padding: 12px 0; }
  .about-sections > details > summary { cursor: pointer; margin-bottom: 12px; font-size: 13px; font-weight: 600; }
  .profile-bio { font-size: 14px; color: ${({ theme }) => theme.colors.editor.fg2}; margin-bottom: 20px; }
  .document-context-links { display: flex; flex-wrap: wrap; gap: 16px; margin: 28px 0; padding-top: 16px; border-top: 1px solid ${({ theme }) => theme.colors.editor.line}; }
  .document-context-links button { display: inline-flex; align-items: center; gap: 6px; background: none; border: 0; padding: 0; font-size: 12px; color: ${({ theme }) => theme.colors.editor.fg2}; cursor: pointer; }
  .document-context-links button:hover { color: ${({ theme }) => theme.colors.editor.accent}; }
  #document-bottom-panel { position: sticky; bottom: 0; z-index: 11; max-height: min(360px, 42dvh); overflow-y: auto; background: ${({ theme }) => theme.colors.editor.bg2}; }
  .panel-footer-label { color: ${({ theme }) => theme.colors.editor.fg3}; font-size: 10px; padding: 6px 24px; background: ${({ theme }) => theme.colors.editor.bg2}; }
  .source-loading { padding: 20px; font-size: 12px; color: ${({ theme }) => theme.colors.editor.fg3}; }
  &.reading-mode .body { max-width: 820px; padding-top: 40px; }
  @media (max-width: 1100px) { .mode-switch button span { display: none; } .body { padding: 28px; } }
  @media (max-width: 960px) {
    .document-grid.with-rail { grid-template-columns: minmax(0, 1fr); }
    .document-toolbar { position: relative; padding: 6px 10px; }
    .breadcrumbs { flex-basis: 100%; padding: 3px; }
    .document-controls { width: 100%; justify-content: flex-end; }
    .mode-switch { margin-right: auto; }
    .mode-switch button span { display: inline; }
    .body, .document-panes--split .body { padding: 24px 20px 36px; }
    .document-panes--split { display: block; height: auto; min-height: 0; }
    .document-panes--split .document-preview, .document-panes--split .document-source { overflow: visible; }
    .document-panes--split.mobile-pane--preview .document-source, .document-panes--split.mobile-pane--source .document-preview { display: none; }
    .mobile-pane-switch { display: flex; }
    .split-options > label, .split-options > span { display: none; }
    .document-source { border-left: 0; }
    #document-bottom-panel { position: relative; bottom: auto; max-height: none; overflow: visible; }
    .post-title { font-size: 28px; }
    .notion-content { font-size: 15px; }
    &.reading-mode .body { padding: 28px 20px; }
  }
`
