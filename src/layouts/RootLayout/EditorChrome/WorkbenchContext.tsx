import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react"

export type SidebarView = "explorer" | "search" | "knowledge"
export type DocumentMode = "preview" | "source" | "split"
export type DocumentContext = {
  slug: string
  title: string
  headings: { id: string; text: string; level: number }[]
}

type WorkbenchState = {
  sidebarView: SidebarView
  setSidebarView: (view: SidebarView) => void
  isSecondaryOpen: boolean
  setSecondaryOpen: (open: boolean) => void
  isPanelOpen: boolean
  setPanelOpen: (open: boolean) => void
  panelTab: "references" | "comments"
  setPanelTab: (tab: "references" | "comments") => void
  readingMode: boolean
  setReadingMode: (enabled: boolean) => void
  settingsOpen: boolean
  setSettingsOpen: (open: boolean) => void
  documentMode: DocumentMode
  setDocumentMode: (mode: DocumentMode) => void
  documentContext: DocumentContext | null
  setDocumentContext: (document: DocumentContext | null) => void
  scrollToHeading: (id: string) => void
}

const WorkbenchContext = createContext<WorkbenchState | null>(null)

export const WorkbenchProvider = ({ children }: { children: ReactNode }) => {
  const [sidebarView, setSidebarView] = useState<SidebarView>("explorer")
  const [isSecondaryOpen, setSecondaryOpen] = useState(true)
  const [isPanelOpen, setPanelOpen] = useState(false)
  const [panelTab, setPanelTab] = useState<"references" | "comments">("references")
  const [readingMode, setReadingMode] = useState(false)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [documentMode, setDocumentMode] = useState<DocumentMode>("preview")
  const [documentContext, setDocumentContext] = useState<DocumentContext | null>(null)

  const scrollToHeading = useCallback((id: string) => {
    setDocumentMode((mode) => mode === "source" || (mode === "split" && window.matchMedia("(max-width: 960px)").matches) ? "preview" : mode)
    // A source-only document must render its preview before the target exists.
    requestAnimationFrame(() => requestAnimationFrame(() => {
      const target = document.getElementById(id)
      if (!target) return
      target.scrollIntoView({
        behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth",
        block: "start",
      })
      const url = new URL(window.location.href)
      url.hash = id
      window.history.replaceState(window.history.state, "", url)
      target.setAttribute("tabindex", "-1")
      target.focus({ preventScroll: true })
    }))
  }, [])

  const value = useMemo(() => ({
    sidebarView, setSidebarView, isSecondaryOpen, setSecondaryOpen,
    isPanelOpen, setPanelOpen, panelTab, setPanelTab, readingMode, setReadingMode,
    settingsOpen, setSettingsOpen, documentMode, setDocumentMode,
    documentContext, setDocumentContext, scrollToHeading,
  }), [sidebarView, isSecondaryOpen, isPanelOpen, panelTab, readingMode, settingsOpen, documentMode, documentContext, scrollToHeading])

  return <WorkbenchContext.Provider value={value}>{children}</WorkbenchContext.Provider>
}

export const useWorkbench = (): WorkbenchState => {
  const value = useContext(WorkbenchContext)
  if (!value) throw new Error("WorkbenchProvider is required for workspace controls")
  return value
}
