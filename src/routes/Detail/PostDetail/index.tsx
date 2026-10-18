import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react"
import { useQueryClient } from "@tanstack/react-query"
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
import { queryKey } from "src/constants/queryKey"
import { getArticleDescription } from "src/libs/utils/notion/articleSummary"
import useSplitSelection from "./useSplitSelection"
import useArticleTranslation from "./useArticleTranslation"
import useTranslationMotion from "./useTranslationMotion"
import Workspace from "./PostWorkspace"
import { renderTranslatedMarkdownDocument } from "./translatedMarkdown"
import type { TNotionDatabase, TPost } from "src/types"

const MarkdownSource = dynamic(() => import("./MarkdownSource"), { loading: () => <p role="status" className="source-loading">Loading source viewer…</p> })
const modes: { id: DocumentMode; label: string; icon: "preview" | "code" | "split" }[] = [{ id: "preview", label: "Preview", icon: "preview" }, { id: "source", label: "Source", icon: "code" }, { id: "split", label: "Split", icon: "split" }]

const PostDetail = () => {
  const data = usePostQuery()
  const queryClient = useQueryClient()
  const allPosts = usePostsQuery()
  const { documentMode, setDocumentMode, setDocumentContext, registerArticleTranslation, isSecondaryOpen, setSecondaryOpen, isPanelOpen, setPanelOpen, panelTab, setPanelTab, readingMode, setReadingMode } = useWorkbench()
  const [mobilePane, setMobilePane] = useState<"preview" | "source">("preview")
  const [syncScroll, setSyncScroll] = useState(true)
  const panes = useRef<HTMLDivElement>(null)
  const workspace = useRef<HTMLDivElement>(null)
  const originalArticle = useMemo(() => ({
    title: data?.title ?? "",
    summary: data ? getArticleDescription(summaryText(data.summary), data.recordMap, data.id) : "",
    recordMap: data?.recordMap ?? null,
  }), [data])
  const translation = useArticleTranslation(originalArticle, data?.slug)
  useTranslationMotion(workspace, translation.active, data?.slug)
  const selectionSync = useSplitSelection(panes, documentMode === "split", data?.slug)
  const headings = useMemo(() => extractToc(translation.article.recordMap).map(heading => ({ ...heading, level: heading.level + 1 })), [translation.article.recordMap])
  const translatedDocument = useMemo(() => {
    if (!translation.active || documentMode === "preview") return null
    const databases = new Map<string, TNotionDatabase>()
    for (const [key, database] of queryClient.getQueriesData<TNotionDatabase>({ queryKey: ["database"] })) {
      if (typeof key[1] === "string" && database) databases.set(key[1], database)
    }
    const publicPageLinks = queryClient.getQueryData<ReadonlyArray<Pick<TPost, "id" | "slug">>>(queryKey.publicPageLinks()) ?? []
    return renderTranslatedMarkdownDocument({ post: data, article: translation.article, allPosts: publicPageLinks, databases })
  }, [translation.active, translation.article, documentMode, queryClient, data])
  const isAbout = Boolean(CONFIG.aboutSlug) && data?.slug === CONFIG.aboutSlug
  const isPage = data?.type[0] === "Page"
  const filename = data ? `${data.slug}.md` : ""
  const statusItems = useMemo(() => ["main", documentMode === "preview" ? "Markdown Preview" : documentMode === "source" ? "Read-only" : "Split Preview", "Markdown"], [documentMode])
  useRegisterChrome(filename, statusItems, isAbout ? "about" : isPage ? "page" : "post")

  useEffect(() => {
    setDocumentContext(data ? { slug: data.slug, title: translation.article.title, headings } : null)
    return () => setDocumentContext(null)
  }, [data, headings, translation.article.title, setDocumentContext])

  useLayoutEffect(() => {
    if (!data?.slug || !translation.supported) return
    return registerArticleTranslation(data.slug, translation.openLanguagePanel)
  }, [data?.slug, translation.supported, translation.openLanguagePanel, registerArticleTranslation])

  useEffect(() => {
    if (documentMode !== "split" || !syncScroll) return
    const preview = panes.current?.querySelector<HTMLElement>(".document-preview")
    const source = panes.current?.querySelector<HTMLElement>(".document-source")
    if (!preview || !source) return
    let locked: HTMLElement | null = null
    let releaseFrame = 0
    const synchronize = (origin: HTMLElement, target: HTMLElement, fromSource: boolean) => {
      if (locked === origin || selectionSync.current || !origin.getClientRects().length || !target.getClientRects().length || !origin.clientWidth || !target.clientWidth) return
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
  }, [documentMode, headings, syncScroll, selectionSync])

  if (!data) return null
  const category = data.category?.[0]
  const published = publishedDate(data)
  const modified = modifiedDate(data)
  const meaningfulModified = modified && published && modified > published && calendarDate(modified) !== calendarDate(published) ? modified : undefined
  const authors = data.author?.map(author => author.name.trim()).filter(Boolean)
  const summary = translation.article.summary
  const openPanel = (tab: "references" | "comments") => { setPanelTab(tab); setPanelOpen(true); setReadingMode(false); requestAnimationFrame(() => document.getElementById("document-bottom-panel")?.scrollIntoView({ block: "start" })) }

  return <Workspace ref={workspace} className={`post-detail${readingMode ? " reading-mode" : ""}`}>
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
    {documentMode === "split" && <div className="split-options"><label><input type="checkbox" checked={syncScroll} onChange={event => setSyncScroll(event.target.checked)} /> Synchronize matched headings</label><span>Drag to highlight matching blocks and reveal the selection in the other pane.</span><div className="mobile-pane-switch"><button type="button" aria-pressed={mobilePane === "preview"} onClick={() => setMobilePane("preview")}>Preview</button><button type="button" aria-pressed={mobilePane === "source"} onClick={() => setMobilePane("source")}>Source</button></div></div>}
    <div className={`document-grid${isSecondaryOpen && !readingMode ? " with-rail" : ""}`}>
      <div className="document-main">
        <div ref={panes} className={`document-panes document-panes--${documentMode} mobile-pane--${mobilePane}`}>
          <div className="document-preview" hidden={documentMode === "source"}>
            <article className={`body${isAbout ? " about-body" : ""}`} lang={translation.active ? translation.targetLanguage : CONFIG.lang}>
              <header><div className="preview-label">Markdown Preview</div><h1 className="post-title">{translation.article.title}</h1><Frontmatter title={translation.article.title} date={published} modifiedDate={meaningfulModified} authors={authors} category={category} tags={data.tags} /></header>
              {summary && !isAbout && <p className="post-summary">{summary}</p>}
              {data.thumbnail && !isAbout && <div className="hero-thumb"><Image src={data.thumbnail} alt={data.title} fill sizes="(max-width: 960px) 100vw, 760px" className="object-cover" /></div>}
              {isAbout && <div className="about-sections"><p className="profile-bio">{CONFIG.profile.role}{CONFIG.profile.bio ? ` · ${CONFIG.profile.bio}` : ""}</p><details open><summary>Writing & activity</summary><StatsGrid stats={getStats(allPosts)} /><ActivityHeatmap /><GitHubContributions username={CONFIG.profile.github} /></details><details><summary>Tools & technologies</summary><StackGrid /></details><details open><summary>Contact</summary><ContactBlock /></details></div>}
              <div className="notion-content"><NotionRenderer recordMap={translation.article.recordMap} manualAds={!isPage && !isAbout} /></div>
              {!isPage && !isAbout && <AdSlot slot={CONFIG.googleAdsense.config.slots.postBottom} className="my-8" />}
              <SeriesNav post={data} allPosts={allPosts} />
              <nav className="document-context-links" aria-label="Article context"><button type="button" onClick={() => openPanel("references")}><WorkbenchIcon name="link" />References & similar articles</button><button type="button" onClick={() => openPanel("comments")}><WorkbenchIcon name="comment" />Comments</button></nav>
              <Footer />
            </article>
          </div>
          {documentMode !== "preview" && <div className="document-source"><MarkdownSource key={data.slug} slug={data.slug} headings={headings} document={translatedDocument ?? undefined} language={translation.active ? translation.targetLanguage : undefined} /></div>}
        </div>
        {translation.controls}
      </div>
      <RightRail recordMap={translation.article.recordMap} post={data} />
    </div>
    <div id="document-bottom-panel"><DocumentPanel key={data.slug} post={data} /></div>
    {isPanelOpen && !readingMode && <div className="panel-footer-label">{panelTab === "references" ? "References" : "Comments"} · {filename}</div>}
  </Workspace>
}

export default PostDetail
