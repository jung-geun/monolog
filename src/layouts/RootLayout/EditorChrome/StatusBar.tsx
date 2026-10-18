import { useState, useEffect } from "react"
import styled from "@emotion/styled"
import WorkbenchIcon from "src/components/WorkbenchIcon"
import { useRouteChrome } from "./RouteChromeContext"
import { useWorkbench } from "./WorkbenchContext"
import { getReadingScrollRoot, observeReadingScroll } from "src/routes/Detail/PostDetail/scrollRoot"

const StatusBar = ({ items }: { items: string[] }) => {
  const { tabs, activeTabId, tabStorageConsent } = useRouteChrome()
  const { documentMode, documentContext } = useWorkbench()
  const [progress, setProgress] = useState(0)
  const [connection, setConnection] = useState<{ ip: string | null; pending: boolean }>({ ip: null, pending: true })
  useEffect(() => {
    const controller = new AbortController()
    const loadAddress = async () => {
      try {
        const response = await fetch("/api/ip", { cache: "no-store", credentials: "same-origin", signal: controller.signal })
        if (!response.ok) throw new Error("Client address unavailable")
        const data: { ip?: unknown } = await response.json()
        if (!controller.signal.aborted) setConnection({ ip: typeof data.ip === "string" ? data.ip : null, pending: false })
      } catch {
        if (!controller.signal.aborted) setConnection({ ip: null, pending: false })
      }
    }
    void loadAddress()
    return () => controller.abort()
  }, [])
  const tab = tabs.find((entry) => entry.id === activeTabId)
  useEffect(() => observeReadingScroll(() => {
    const root = getReadingScrollRoot()
    const position = root instanceof HTMLElement ? root.scrollTop : window.scrollY
    const height = root instanceof HTMLElement ? root.scrollHeight - root.clientHeight : document.documentElement.scrollHeight - window.innerHeight
    setProgress(height > 0 ? Math.min(100, Math.max(0, Math.round(position / height * 100))) : 100)
  }), [activeTabId, documentMode, documentContext])
  const metadata = items.filter((item) => item !== "main" && !/synced|ssh|0\.0\.0\.0/i.test(item))
  return <StyledWrapper aria-label="Editor status">
    <span className="remote-connection" title={connection.ip ? `Visitor IP: ${connection.ip}. SSH-style display only; this website does not open an SSH connection.` : connection.pending ? "Looking up your address on this site" : "Your visitor address is unavailable. No SSH connection is opened."}>
      <WorkbenchIcon name="remote" size={14} /><span>SSH: {connection.ip ?? (connection.pending ? "connecting…" : "unavailable")}</span>
    </span>
    <span className="document-state"><WorkbenchIcon name={tab?.kind === "post" ? "book" : "info"} size={14} />{tab?.kind === "post" ? "Published post" : tab?.kind === "about" ? "Published page" : "Read-only workspace"}{tab?.preview && <span className="preview-note"> · Preview</span>}</span>
    <span className="storage-state" title="Tab storage can be changed in Activity Bar Settings">{tabStorageConsent === "enabled" ? "Tabs saved locally" : tabStorageConsent === "unavailable" ? "Local storage unavailable" : "Tabs: this visit"}</span>
    <div className="metadata">{metadata.map((item, index) => <span key={`${index}:${item}`}>{item}</span>)}</div>
    {documentContext && <span className="reading-progress" title="Reading position">{progress}% · {documentMode}</span>}
  </StyledWrapper>
}
export default StatusBar

const StyledWrapper = styled.footer`
  flex-shrink: 0;
  box-sizing: border-box;
  width: 100%;
  min-width: 0;
  min-height: ${({ theme }) => theme.variables.statusBarHeight}px;
  display: flex;
  align-items: center;
  gap: 14px;
  padding: 0 12px 0 0;
  font-family: var(--font-ui, sans-serif);
  font-size: 11px;
  background: ${({ theme }) => theme.colors.editor.bg2};
  color: ${({ theme }) => theme.colors.editor.fg2};
  border-top: 1px solid ${({ theme }) => theme.colors.editor.line};
  .remote-connection { align-self: stretch; display: flex; align-items: center; gap: 5px; flex-shrink: 1; min-width: 0; max-width: min(310px, 38vw); padding: 0 10px; background: #0078d4; color: #fff; font-family: var(--font-mono, monospace); }
  .remote-connection svg { flex-shrink: 0; }
  .remote-connection > span { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .document-state { display: flex; align-items: center; gap: 5px; white-space: nowrap; }
  .metadata { display: flex; gap: 14px; flex: 1; overflow: hidden; white-space: nowrap; }
  .storage-state { white-space: nowrap; }
  .reading-progress { margin-left: auto; white-space: nowrap; font-variant-numeric: tabular-nums; }
  @media (max-width: 960px) { position: relative; z-index: 35; min-height: 24px; gap: 8px; padding: 0 8px 0 0; .metadata, .document-state { display: none; } .remote-connection { padding: 0 8px; } .storage-state { margin-left: auto; font-size: 10px; } }
`
