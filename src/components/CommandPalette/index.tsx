import { useEffect, useRef, useState, useMemo, type ReactNode, type KeyboardEvent } from "react"
import { useRouter } from "next/compat/router"
import styled from "@emotion/styled"
import useCommandPalette from "src/hooks/useCommandPalette"
import usePostsQuery from "src/hooks/usePostsQuery"
import { useCategoriesQuery } from "src/hooks/useCategoriesQuery"
import { useTagsQuery } from "src/hooks/useTagsQuery"
import useColorTheme from "src/hooks/useColorTheme"
import { DEFAULT_CATEGORY } from "src/constants"
import WorkbenchIcon from "src/components/WorkbenchIcon"
import FileIcon from "src/components/FileIcon"
import { useWorkbench, type SidebarView } from "src/layouts/RootLayout/EditorChrome/WorkbenchContext"
import { useRouteChrome } from "src/layouts/RootLayout/EditorChrome/RouteChromeContext"
import { CONFIG } from "site.config"

type CommandKind = "action" | "post" | "tag" | "category" | "heading"
type Command = {
  id: string
  kind: CommandKind
  label: string
  sub?: string
  icon: ReactNode
  href?: string
  action?: () => void
}
const groups: Record<CommandKind, string> = {
  action: "Commands", post: "Files", tag: "Tags", category: "Categories", heading: "Document symbols",
}

export default function CommandPalette() {
  const { open, initialQuery, closePalette } = useCommandPalette()
  return open ? <QuickPick key={initialQuery} initialQuery={initialQuery} closePalette={closePalette} /> : null
}

function QuickPick({ initialQuery, closePalette }: { initialQuery: string; closePalette: () => void }) {
  const router = useRouter()
  const posts = usePostsQuery()
  const categories = useCategoriesQuery()
  const tags = useTagsQuery()
  const { themes, preference, setTheme } = useColorTheme()
  const workspace = useWorkbench()
  const chrome = useRouteChrome()
  const [query, setQuery] = useState(initialQuery)
  const [selected, setSelected] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)
  const resultsRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const previous = document.activeElement instanceof HTMLElement ? document.activeElement : null
    inputRef.current?.focus()
    return () => { if (previous?.isConnected) previous.focus({ preventScroll: true }) }
  }, [])

  const commands = useMemo((): Command[] => {
    const showSidebar = (view: SidebarView) => {
      workspace.setReadingMode(false)
      workspace.setSidebarView(view)
      chrome.setFileTreeOpen(true)
    }
    const actions: Command[] = [
      { id: "welcome", kind: "action", label: "Welcome: Open Start Page", icon: <WorkbenchIcon name="files" />, href: "/" },
      { id: "explorer", kind: "action", label: "View: Show Explorer", icon: <WorkbenchIcon name="files" />, action: () => showSidebar("explorer") },
      { id: "search", kind: "action", label: "View: Search in Sidebar", icon: <WorkbenchIcon name="search" />, action: () => showSidebar("search") },
      { id: "search-editor", kind: "action", label: "Search: Open Search Editor", icon: <WorkbenchIcon name="search" />, href: "/search" },
      { id: "knowledge", kind: "action", label: "View: Show Knowledge", icon: <WorkbenchIcon name="graph" />, action: () => showSidebar("knowledge") },
      { id: "graph", kind: "action", label: "Knowledge: Open Graph", icon: <WorkbenchIcon name="graph" />, href: "/graph" },
      { id: "ontology", kind: "action", label: "Knowledge: Open Ontology", icon: <WorkbenchIcon name="graph" />, href: "/ontology" },
      { id: "settings", kind: "action", label: "Preferences: Open Settings", icon: <WorkbenchIcon name="settings" />, action: () => workspace.setSettingsOpen(true) },
      { id: "reading", kind: "action", label: `View: ${workspace.readingMode ? "Leave" : "Enter"} Reading Mode`, icon: <WorkbenchIcon name="book" />, action: () => workspace.setReadingMode(!workspace.readingMode) },
      { id: "sidebar", kind: "action", label: "View: Toggle Primary Sidebar", icon: <WorkbenchIcon name="layout-sidebar" />, action: () => { chrome.setFileTreeOpen(!chrome.isFileTreeOpen || workspace.readingMode); workspace.setReadingMode(false) } },
      { id: "reopen", kind: "action", label: "File: Reopen Closed Post", icon: <WorkbenchIcon name="history" />, action: chrome.reopenLastPost },
      ...themes.map((theme): Command => ({ id: `theme:${theme.id}`, kind: "action", label: `Preferences: Color Theme — ${theme.label}`, sub: preference === theme.id ? "Current theme" : undefined, icon: <WorkbenchIcon name="sun" />, action: () => setTheme(theme.id) })),
      { id: "theme:system", kind: "action", label: "Preferences: Color Theme — System", sub: preference === "system" ? "Current theme · follows your device" : "Follow your device", icon: <WorkbenchIcon name="sun" />, action: () => setTheme("system") },
    ]
    if (CONFIG.aboutSlug) actions.push({ id: "about", kind: "action", label: "Welcome: Open About", icon: <FileIcon name="about.md" />, href: `/${CONFIG.aboutSlug}` })
    if (workspace.documentContext) {
      for (const mode of ["preview", "source", "split"] as const) {
        actions.push({ id: `mode:${mode}`, kind: "action", label: `Markdown: Open ${mode === "split" ? "Split Preview and Source" : mode === "source" ? "Source" : "Preview"}`, icon: <WorkbenchIcon name={mode === "split" ? "split" : mode === "source" ? "code" : "preview"} />, action: () => workspace.setDocumentMode(mode) })
      }
      actions.push(
        { id: "outline", kind: "action", label: "View: Toggle Outline and Series", icon: <WorkbenchIcon name="layout-right" />, action: () => { workspace.setSecondaryOpen(!workspace.isSecondaryOpen || workspace.readingMode); workspace.setReadingMode(false) } },
        { id: "references", kind: "action", label: "View: Open References Panel", icon: <WorkbenchIcon name="link" />, action: () => { workspace.setPanelTab("references"); workspace.setPanelOpen(true); workspace.setReadingMode(false) } },
        { id: "comments", kind: "action", label: "View: Open Comments Panel", icon: <WorkbenchIcon name="comment" />, action: () => { workspace.setPanelTab("comments"); workspace.setPanelOpen(true); workspace.setReadingMode(false) } },
      )
    }
    const headings = (workspace.documentContext?.headings ?? []).map((heading): Command => ({
      id: `heading:${heading.id}`, kind: "heading", label: heading.text,
      sub: `Heading ${heading.level} · ${workspace.documentContext?.title}`,
      icon: <WorkbenchIcon name="book" />, action: () => workspace.scrollToHeading(heading.id),
    }))
    return [
      ...posts.map((post): Command => ({ id: `post:${post.slug}`, kind: "post", label: post.title, sub: `${post.slug}.md`, icon: <FileIcon name={`${post.slug}.md`} />, href: `/${post.slug}` })),
      ...actions.filter((command) => command.id !== "reopen" || chrome.canReopenPost),
      ...Object.keys(tags).map((tag): Command => ({ id: `tag:${tag}`, kind: "tag", label: tag, icon: <WorkbenchIcon name="search" />, href: `/search?q=${encodeURIComponent(`tag:${JSON.stringify(tag)}`)}` })),
      ...Object.keys(categories).filter((category) => category !== DEFAULT_CATEGORY).map((category): Command => ({ id: `category:${category}`, kind: "category", label: category, sub: `${categories[category]} posts`, icon: <FileIcon name={category} folder />, href: `/search?q=${encodeURIComponent(`category:${JSON.stringify(category)}`)}` })),
      ...headings,
    ]
  }, [posts, categories, tags, themes, preference, setTheme, workspace, chrome])

  const mode = query.startsWith(">") ? "commands" : query.startsWith("@") ? "headings" : "files"
  const filtered = useMemo(() => {
    const terms = (mode === "files" ? query : query.slice(1)).trim().toLocaleLowerCase().split(/\s+/).filter(Boolean)
    return commands.filter((command) => {
      if (mode === "commands" && command.kind !== "action") return false
      if (mode === "headings" && command.kind !== "heading") return false
      if (mode === "files" && command.kind === "heading") return false
      const text = `${command.label} ${command.sub ?? ""}`.toLocaleLowerCase()
      return terms.every((term) => text.includes(term))
    }).slice(0, 80)
  }, [commands, mode, query])
  const active = Math.min(selected, Math.max(0, filtered.length - 1))
  useEffect(() => {
    resultsRef.current?.querySelector('[aria-selected="true"]')?.scrollIntoView({ block: "nearest" })
  }, [active, query])

  const execute = (command: Command) => {
    closePalette()
    if (command.action) command.action()
    else if (command.href) void router?.push(command.href)
  }
  const handleKey = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Tab") { event.preventDefault(); return }
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault()
      if (filtered.length) setSelected((active + (event.key === "ArrowDown" ? 1 : -1) + filtered.length) % filtered.length)
    } else if (event.key === "Enter" && !event.nativeEvent.isComposing) {
      event.preventDefault()
      if (filtered[active]) execute(filtered[active])
    }
  }
  return (
    <Overlay onClick={(event) => { if (event.target === event.currentTarget) closePalette() }}>
      <Panel role="dialog" aria-modal="true" aria-label="Workspace Quick Pick">
        <div className="input-row">
          <input ref={inputRef} role="combobox" aria-label="Search files, commands, or headings" aria-autocomplete="list" aria-expanded="true" aria-controls="quick-pick-results" aria-activedescendant={filtered.length ? `quick-pick-${active}` : undefined} value={query} onChange={(event) => { setQuery(event.target.value); setSelected(0) }} onKeyDown={handleKey} placeholder="Search files · > commands · @ headings" autoComplete="off" spellCheck={false} />
        </div>
        <div id="quick-pick-results" ref={resultsRef} className="results" role="listbox" aria-label={mode}>
          {filtered.map((command, index) => <div key={command.id}>
            {(index === 0 || filtered[index - 1].kind !== command.kind) && <div className="group-label" role="presentation">{groups[command.kind]}</div>}
            <div id={`quick-pick-${index}`} role="option" aria-selected={active === index} className="result" onMouseEnter={() => setSelected(index)} onMouseDown={(event) => event.preventDefault()} onClick={() => execute(command)}>
              <span className="icon">{command.icon}</span><span className="label">{command.label}</span>{command.sub && <span className="description">{command.sub}</span>}
            </div>
          </div>)}
        </div>
        {!filtered.length && <div className="empty">{mode === "headings" && !workspace.documentContext ? "Open a document to browse its headings." : "No matching entries."}</div>}
        <div className="footer"><span>↑↓ navigate</span><span>↵ open</span><span>Esc close</span><span className="modes">&gt; commands · @ headings</span></div>
      </Panel>
    </Overlay>
  )
}

const Overlay = styled.div`
  position: fixed; inset: 0; z-index: 1000; display: flex; align-items: flex-start; justify-content: center; padding-top: 8px;
  @media (max-width: 960px) { padding-top: 44px; }
`
const Panel = styled.div`
  width: 640px; max-width: calc(100vw - 16px); color: var(--editor-fg); background: var(--editor-bg2); border: 1px solid var(--editor-line2); border-radius: 6px; box-shadow: 0 8px 30px #0005; font-family: var(--font-ui); font-size: 13px; overflow: hidden;
  .input-row { padding: 6px; }
  input { width: 100%; min-width: 0; padding: 6px 8px; border: 1px solid var(--editor-accent); border-radius: 2px; color: var(--editor-fg); background: var(--editor-bg); outline: none; font: inherit; }
  input::placeholder { color: var(--editor-fg3); }
  .results { max-height: min(480px, 65dvh); overflow-y: auto; }
  .group-label { color: var(--editor-fg3); font-size: 11px; padding: 6px 12px 3px; border-top: 1px solid var(--editor-line); }
  .result { display: flex; gap: 8px; align-items: center; min-height: 28px; padding: 4px 12px; cursor: pointer; }
  .result[aria-selected="true"] { background: var(--editor-accentSoft); }
  .icon { display: flex; flex-shrink: 0; }
  .label { min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .description { min-width: 0; color: var(--editor-fg3); font-size: 11px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .empty { padding: 16px 12px; color: var(--editor-fg3); }
  .footer { display: flex; flex-wrap: wrap; gap: 12px; padding: 6px 12px; border-top: 1px solid var(--editor-line); color: var(--editor-fg3); font-size: 10px; }
  .modes { margin-left: auto; }
  @media (max-width: 600px) { .description { display: none; } }
`
