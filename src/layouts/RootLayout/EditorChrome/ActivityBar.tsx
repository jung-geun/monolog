import styled from "@emotion/styled"
import WorkbenchIcon from "src/components/WorkbenchIcon"
import { useRouteChrome } from "./RouteChromeContext"
import { SidebarView, useWorkbench } from "./WorkbenchContext"

const views = [
  { view: "explorer", icon: "files", label: "Explorer" },
  { view: "search", icon: "search", label: "Search" },
  { view: "knowledge", icon: "graph", label: "Knowledge" },
] as const

const ActivityBar = () => {
  const { isFileTreeOpen, setFileTreeOpen } = useRouteChrome()
  const { sidebarView, setSidebarView, settingsOpen, setSettingsOpen, readingMode, setReadingMode } = useWorkbench()
  const selectView = (view: SidebarView) => {
    setReadingMode(false)
    setFileTreeOpen(readingMode || sidebarView !== view || !isFileTreeOpen)
    setSidebarView(view)
  }
  return <StyledWrapper aria-label="Workbench views">
    {views.map(({ view, icon, label }) => <button key={view} type="button" title={label} aria-label={label} aria-pressed={sidebarView === view && isFileTreeOpen && !readingMode} aria-controls="primary-sidebar" onClick={() => selectView(view)}><WorkbenchIcon name={icon} size={24} /></button>)}
    <button type="button" title="Command palette · Cmd/Ctrl+Shift+P" aria-label="Command palette" onClick={() => window.dispatchEvent(new CustomEvent("open-command-palette", { detail: { query: ">" } }))}><WorkbenchIcon name="command" size={24} /></button>
    <div className="spacer" />
    <button type="button" title="Reading mode" aria-label="Toggle reading mode" aria-pressed={readingMode} onClick={() => setReadingMode(!readingMode)}><WorkbenchIcon name="book" size={24} /></button>
    <button type="button" title="Settings" aria-label="Settings" aria-pressed={settingsOpen} aria-haspopup="dialog" aria-controls={settingsOpen ? "workbench-settings" : undefined} onClick={() => setSettingsOpen(!settingsOpen)}><WorkbenchIcon name="settings" size={24} /></button>
  </StyledWrapper>
}
export default ActivityBar

const StyledWrapper = styled.nav`
  width: ${({ theme }) => theme.variables.activityBarWidth}px;
  flex-shrink: 0;
  display: flex;
  flex-direction: column;
  background: ${({ theme }) => theme.colors.editor.bg2};
  border-right: 1px solid ${({ theme }) => theme.colors.editor.line};
  font-family: var(--font-ui, sans-serif);
  button { position: relative; display: grid; place-items: center; width: 100%; height: 48px; border: 0; border-left: 2px solid transparent; background: transparent; color: ${({ theme }) => theme.colors.editor.fg3}; cursor: pointer; }
  button:hover, button[aria-pressed="true"] { color: ${({ theme }) => theme.colors.editor.fg}; background: ${({ theme }) => theme.colors.editor.bg3}; }
  button[aria-pressed="true"] { border-left-color: ${({ theme }) => theme.colors.editor.accent}; }
  button:focus-visible { outline: 1px solid ${({ theme }) => theme.colors.editor.accent}; outline-offset: -3px; }
  .spacer { flex: 1; }
  @media (max-width: 960px) { width: 100%; flex-direction: row; position: relative; z-index: 55; border-right: 0; border-bottom: 1px solid ${({ theme }) => theme.colors.editor.line}; button { width: 44px; height: 40px; border-left: 0; border-bottom: 2px solid transparent; } button[aria-pressed="true"] { border-bottom-color: ${({ theme }) => theme.colors.editor.accent}; } }
`
