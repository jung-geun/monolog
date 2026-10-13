import { useState, useEffect } from "react"
import styled from "@emotion/styled"
import WorkbenchIcon from "src/components/WorkbenchIcon"
import { useRouteChrome } from "./RouteChromeContext"
import { useWorkbench } from "./WorkbenchContext"
import { getReadingScrollRoot } from "src/routes/Detail/PostDetail/scrollRoot"

const StatusBar = ({ items }: { items: string[] }) => {
  const { tabs, activeTabId, tabStorageConsent } = useRouteChrome()
  const { documentMode, documentContext, setSettingsOpen } = useWorkbench()
  const [progress, setProgress] = useState(0)
  const tab = tabs.find((entry) => entry.id === activeTabId)
  useEffect(() => {
    const roots = Array.from(document.querySelectorAll<HTMLElement>(".page-content, .document-panes--split .document-preview"))
    const update = () => {
      const root = getReadingScrollRoot()
      const position = root instanceof HTMLElement ? root.scrollTop : window.scrollY
      const height = root instanceof HTMLElement ? root.scrollHeight - root.clientHeight : document.documentElement.scrollHeight - window.innerHeight
      setProgress(height > 0 ? Math.min(100, Math.max(0, Math.round(position / height * 100))) : 100)
    }
    update()
    for (const root of roots) root.addEventListener("scroll", update, { passive: true })
    window.addEventListener("scroll", update, { passive: true })
    window.addEventListener("resize", update)
    const observer = new ResizeObserver(update)
    observer.observe(document.documentElement)
    for (const root of roots) {
      observer.observe(root)
      for (const child of root.children) observer.observe(child)
    }
    return () => {
      for (const root of roots) root.removeEventListener("scroll", update)
      window.removeEventListener("scroll", update)
      window.removeEventListener("resize", update)
      observer.disconnect()
    }
  }, [activeTabId, documentMode, documentContext])
  const metadata = items.filter((item) => item !== "main" && !/synced|ssh|0\.0\.0\.0/i.test(item))
  return <StyledWrapper aria-label="Editor status">
    <span className="document-state"><WorkbenchIcon name={tab?.kind === "post" ? "book" : "info"} size={14} />{tab?.kind === "post" ? "Published post" : tab?.kind === "about" ? "Published page" : "Read-only workspace"}{tab?.preview && <span className="preview-note"> · Preview</span>}</span>
    <button type="button" className="storage-state" onClick={() => setSettingsOpen(true)} title="Local tab storage settings">{tabStorageConsent === "enabled" ? "Tabs saved locally" : tabStorageConsent === "unavailable" ? "Local storage unavailable" : "Tabs: this visit"}</button>
    <div className="metadata">{metadata.map((item, index) => <span key={`${index}:${item}`}>{item}</span>)}</div>
    {documentContext && <span className="reading-progress" title="Reading position">{progress}% · {documentMode}</span>}
  </StyledWrapper>
}
export default StatusBar

const StyledWrapper = styled.footer`
  flex-shrink: 0;
  width: 100%;
  min-height: ${({ theme }) => theme.variables.statusBarHeight}px;
  display: flex;
  align-items: center;
  gap: 14px;
  padding: 0 12px;
  font-family: var(--font-ui, sans-serif);
  font-size: 11px;
  background: ${({ theme }) => theme.colors.editor.bg2};
  color: ${({ theme }) => theme.colors.editor.fg2};
  border-top: 1px solid ${({ theme }) => theme.colors.editor.line};
  .document-state { display: flex; align-items: center; gap: 5px; white-space: nowrap; }
  .metadata { display: flex; gap: 14px; flex: 1; overflow: hidden; white-space: nowrap; }
  .storage-state { background: transparent; color: inherit; font: inherit; cursor: pointer; padding: 2px 4px; border: 0; white-space: nowrap; }
  .storage-state:hover { background: ${({ theme }) => theme.colors.editor.bg3}; }
  .storage-state:focus-visible { outline: 1px solid ${({ theme }) => theme.colors.editor.accent}; }
  .reading-progress { margin-left: auto; white-space: nowrap; font-variant-numeric: tabular-nums; }
  @media (max-width: 960px) { position: sticky; bottom: 0; z-index: 35; min-height: 24px; gap: 8px; padding: 0 8px; .metadata, .preview-note { display: none; } .storage-state { margin-left: auto; font-size: 10px; } }
`
