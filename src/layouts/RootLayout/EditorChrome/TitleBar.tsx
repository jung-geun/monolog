import { useEffect, useRef, useState } from "react"
import { useRouter } from "next/compat/router"
import styled from "@emotion/styled"
import WorkbenchIcon from "src/components/WorkbenchIcon"
import { useRouteChrome } from "./RouteChromeContext"
import { useWorkbench } from "./WorkbenchContext"

const TitleBar = ({ filename }: { filename: string }) => {
  const events = useRouter()?.events
  const { isFileTreeOpen, setFileTreeOpen } = useRouteChrome()
  const { isSecondaryOpen, setSecondaryOpen, isPanelOpen, setPanelOpen, readingMode, setReadingMode, settingsOpen, setSettingsOpen, documentContext } = useWorkbench()
  const historyEntries = useRef<string[]>([])
  const historyIndex = useRef(0)
  const [historyPosition, setHistoryPosition] = useState({ index: 0, length: 1 })
  useEffect(() => {
    if (!events) return
    const record = () => {
      const key = String(window.history.state?.key ?? window.location.href)
      const entries = historyEntries.current
      const existing = entries.indexOf(key)
      if (existing >= 0) {
        historyIndex.current = existing
        setHistoryPosition({ index: existing, length: entries.length })
      } else {
        const next = entries.slice(0, historyIndex.current + 1)
        next.push(key)
        historyEntries.current = next
        historyIndex.current = next.length - 1
        setHistoryPosition({ index: historyIndex.current, length: next.length })
      }
    }
    historyEntries.current = [String(window.history.state?.key ?? window.location.href)]
    historyIndex.current = 0
    events.on("routeChangeComplete", record)
    events.on("hashChangeComplete", record)
    return () => {
      events.off("routeChangeComplete", record)
      events.off("hashChangeComplete", record)
    }
  }, [events])
  return <StyledWrapper>
    <span className="workspace-name">pieroot.log</span>
    <div className="history-controls">
      <button type="button" aria-label="Go back" title="Go back" disabled={historyPosition.index === 0} onClick={() => window.history.back()}><WorkbenchIcon name="arrow-left" /></button>
      <button type="button" aria-label="Go forward" title="Go forward" disabled={historyPosition.index >= historyPosition.length - 1} onClick={() => window.history.forward()}><WorkbenchIcon name="arrow-right" /></button>
    </div>
    <button type="button" className="command-center" title="Search workspace · Cmd/Ctrl+K" aria-label="Search workspace" onClick={() => window.dispatchEvent(new CustomEvent("open-command-palette", { detail: { query: "" } }))}>
      <WorkbenchIcon name="search" /><span>Search pieroot.log</span><span className="current-file">{filename === "README.md" ? "Welcome" : filename}</span>
    </button>
    <div className="layout-controls">
      <button type="button" aria-label="Toggle primary sidebar" title="Toggle primary sidebar" aria-pressed={isFileTreeOpen && !readingMode} onClick={() => { setReadingMode(false); setFileTreeOpen(readingMode || !isFileTreeOpen) }}><WorkbenchIcon name="layout-sidebar" /></button>
      <button type="button" aria-label="Toggle bottom panel" title={documentContext ? "Toggle bottom panel" : "Open a post to show references and comments"} disabled={!documentContext} aria-pressed={!!documentContext && isPanelOpen && !readingMode} onClick={() => { setReadingMode(false); setPanelOpen(readingMode || !isPanelOpen) }}><WorkbenchIcon name="layout-panel" /></button>
      <button type="button" aria-label="Toggle secondary sidebar" title={documentContext ? "Toggle secondary sidebar" : "Open a post to show its outline and series"} disabled={!documentContext} aria-pressed={!!documentContext && isSecondaryOpen && !readingMode} onClick={() => { setReadingMode(false); setSecondaryOpen(readingMode || !isSecondaryOpen) }}><WorkbenchIcon name="layout-right" /></button>
      <button type="button" aria-label="Open settings" title="Settings" aria-pressed={settingsOpen} onClick={() => setSettingsOpen(!settingsOpen)}><WorkbenchIcon name="settings" /></button>
    </div>
  </StyledWrapper>
}
export default TitleBar

const StyledWrapper = styled.header`
  height: ${({ theme }) => theme.variables.titleBarHeight}px;
  flex-shrink: 0;
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 0 10px;
  border-bottom: 1px solid ${({ theme }) => theme.colors.editor.line};
  background: ${({ theme }) => theme.colors.editor.bg2};
  font-family: var(--font-ui, sans-serif);
  font-size: 12px;
  .workspace-name { width: 140px; color: ${({ theme }) => theme.colors.editor.fg2}; }
  .history-controls, .layout-controls { display: flex; gap: 2px; }
  button { display: flex; align-items: center; justify-content: center; gap: 8px; border: 0; background: transparent; color: ${({ theme }) => theme.colors.editor.fg2}; min-width: 28px; min-height: 28px; border-radius: 4px; cursor: pointer; font: inherit; }
  button:hover:not(:disabled), button[aria-pressed="true"] { background: ${({ theme }) => theme.colors.editor.bg3}; color: ${({ theme }) => theme.colors.editor.fg}; }
  button:focus-visible { outline: 1px solid ${({ theme }) => theme.colors.editor.accent}; outline-offset: -1px; }
  button:disabled { opacity: .35; cursor: default; }
  .command-center { flex: 1; max-width: 640px; margin: 0 auto; padding: 0 12px; min-width: 0; min-height: 26px; border: 1px solid ${({ theme }) => theme.colors.editor.line}; background: ${({ theme }) => theme.colors.editor.bg3}; }
  .current-file { margin-left: auto; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; opacity: .65; }
  @media (max-width: 960px) { position: relative; z-index: 60; .workspace-name, .current-file, .layout-controls button:nth-child(2), .layout-controls button:nth-child(3) { display: none; } gap: 4px; padding: 0 5px; }
`
