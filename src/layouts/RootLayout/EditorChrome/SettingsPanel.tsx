import { useEffect, useRef } from "react"
import styled from "@emotion/styled"
import ThemePicker from "src/components/ThemePicker"
import WorkbenchIcon from "src/components/WorkbenchIcon"
import { useRouteChrome } from "./RouteChromeContext"
import { useWorkbench } from "./WorkbenchContext"
import TabSessionControls from "./TabSessionControls"

const SettingsPanel = () => {
  const { isFileTreeOpen, setFileTreeOpen } = useRouteChrome()
  const { settingsOpen, setSettingsOpen, readingMode, setReadingMode, isSecondaryOpen, setSecondaryOpen, isPanelOpen, setPanelOpen } = useWorkbench()
  const panelRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!settingsOpen) return
    const previousFocus = document.activeElement as HTMLElement | null
    panelRef.current?.querySelector<HTMLButtonElement>("button")?.focus()
    return () => previousFocus?.focus({ preventScroll: true })
  }, [settingsOpen])
  if (!settingsOpen) return null
  return <StyledOverlay>
    <button type="button" className="backdrop" aria-label="Close settings" onClick={() => setSettingsOpen(false)} />
    <div ref={panelRef} role="dialog" aria-modal="true" aria-labelledby="workbench-settings-title" className="settings" onKeyDown={(event) => {
      if (event.key === "Escape") { event.preventDefault(); setSettingsOpen(false) }
      if (event.key !== "Tab") return
      const controls = Array.from(event.currentTarget.querySelectorAll<HTMLElement>('button:not(:disabled), a[href], input:not(:disabled), select:not(:disabled), [tabindex="0"]'))
      const first = controls[0]
      const last = controls[controls.length - 1]
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus() }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus() }
    }}>
      <header><h2 id="workbench-settings-title"><WorkbenchIcon name="settings" />Settings</h2><button type="button" aria-label="Close settings" onClick={() => setSettingsOpen(false)}><WorkbenchIcon name="close" /></button></header>
      <section className="setting-section"><h3>Color theme</h3><ThemePicker /></section>
      <section className="setting-section"><h3>Workbench layout</h3>
        <label><input type="checkbox" checked={isFileTreeOpen} onChange={(event) => { setReadingMode(false); setFileTreeOpen(event.target.checked) }} />Primary sidebar</label>
        <label><input type="checkbox" checked={isSecondaryOpen} onChange={(event) => { setReadingMode(false); setSecondaryOpen(event.target.checked) }} />Outline and series sidebar</label>
        <label><input type="checkbox" checked={isPanelOpen} onChange={(event) => { setReadingMode(false); setPanelOpen(event.target.checked) }} />References and comments panel</label>
        <label><input type="checkbox" checked={readingMode} onChange={(event) => setReadingMode(event.target.checked)} />Reading mode — hide sidebars and panel</label>
      </section>
      <TabSessionControls preferencesOpen onClosePreferences={() => setSettingsOpen(false)} />
    </div>
  </StyledOverlay>
}
export default SettingsPanel

const StyledOverlay = styled.div`
  position: fixed; inset: 0; z-index: 100;
  font-family: var(--font-ui, sans-serif);
  .backdrop { position: absolute; inset: 0; width: 100%; height: 100%; background: #0006; border: 0; cursor: default; }
  .settings { position: absolute; right: 16px; top: 48px; width: min(520px, calc(100% - 32px)); max-height: calc(100dvh - 80px); overflow-y: auto; border: 1px solid ${({ theme }) => theme.colors.editor.line}; background: ${({ theme }) => theme.colors.editor.bg2}; color: ${({ theme }) => theme.colors.editor.fg}; border-radius: 5px; box-shadow: 0 12px 40px #0005; }
  header { display: flex; align-items: center; justify-content: space-between; padding: 12px 16px; border-bottom: 1px solid ${({ theme }) => theme.colors.editor.line}; }
  h2 { display: flex; align-items: center; gap: 8px; margin: 0; font-size: 14px; font-weight: 600; }
  header button { display: grid; place-items: center; width: 30px; height: 30px; color: inherit; background: transparent; border: 0; cursor: pointer; }
  button:focus-visible, input:focus-visible, select:focus-visible { outline: 2px solid ${({ theme }) => theme.colors.editor.accent}; outline-offset: 2px; }
  .setting-section { padding: 14px 16px; border-bottom: 1px solid ${({ theme }) => theme.colors.editor.line}; }
  h3 { font-size: 12px; margin: 0 0 10px; }
  label { display: flex; gap: 8px; align-items: center; padding: 6px 0; font-size: 12px; cursor: pointer; }
  input[type="checkbox"] { appearance: auto; width: 14px; height: 14px; flex-shrink: 0; accent-color: ${({ theme }) => theme.colors.editor.accent}; }
  @media (max-width: 600px) { .settings { inset: 12px; width: auto; max-height: none; } }
`
