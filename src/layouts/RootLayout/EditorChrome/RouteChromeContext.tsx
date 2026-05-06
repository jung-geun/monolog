import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  ReactNode,
  useRef,
} from "react"
import { useRouter } from "next/router"

// ---------------------------------------------------------------------------
// Tab types
// ---------------------------------------------------------------------------

export type TabKind = "readme" | "post" | "category" | "series" | "graph" | "about" | "page"

export type Tab = {
  id: string
  kind: TabKind
  label: string
  href: string
  closeable: boolean
}

const README_TAB: Tab = {
  id: "readme",
  kind: "readme",
  label: "README.md",
  href: "/",
  closeable: false,
}

// ---------------------------------------------------------------------------
// Chrome config (status bar items)
// ---------------------------------------------------------------------------

export type ChromeConfig = {
  filename: string
  statusItems: string[]
}

const defaultChrome: ChromeConfig = {
  filename: "README.md",
  statusItems: ["main", "✓ synced", "UTF-8", "Markdown"],
}

// ---------------------------------------------------------------------------
// Context value
// ---------------------------------------------------------------------------

type RouteChromeContextValue = {
  // Tab API
  tabs: Tab[]
  activeTabId: string
  openTab: (tab: Tab) => void
  closeTab: (id: string) => void
  switchTab: (id: string) => void

  // Legacy chrome API (for StatusBar)
  chrome: ChromeConfig
  setChrome: (config: ChromeConfig) => void

  // File tree panel
  isFileTreeOpen: boolean
  setFileTreeOpen: (open: boolean) => void
  toggleFileTree: () => void

  // File tree section expand/collapse
  expanded: Record<string, boolean>
  toggleSection: (key: string) => void
}

const defaultExpanded: Record<string, boolean> = {
  posts: true,
  categories: false,
  series: false,
  projects: false,
  drafts: false,
  public: false,
}

const RouteChromeContext = createContext<RouteChromeContextValue>({
  tabs: [README_TAB],
  activeTabId: "readme",
  openTab: () => {},
  closeTab: () => {},
  switchTab: () => {},
  chrome: defaultChrome,
  setChrome: () => {},
  isFileTreeOpen: true,
  setFileTreeOpen: () => {},
  toggleFileTree: () => {},
  expanded: defaultExpanded,
  toggleSection: () => {},
})

export const useRouteChrome = () => useContext(RouteChromeContext)

// ---------------------------------------------------------------------------
// Provider
// ---------------------------------------------------------------------------

export const RouteChromeProvider = ({ children }: { children: ReactNode }) => {
  const router = useRouter()
  const [chrome, setChrome] = useState<ChromeConfig>(defaultChrome)
  const [isFileTreeOpen, setFileTreeOpen] = useState(true)
  const [expanded, setExpanded] = useState<Record<string, boolean>>(defaultExpanded)
  const [tabs, setTabs] = useState<Tab[]>([README_TAB])
  const [activeTabId, setActiveTabId] = useState<string>("readme")
  const routerRef = useRef(router)
  routerRef.current = router
  const tabsRef = useRef(tabs)
  tabsRef.current = tabs

  // Close sidebar on mobile on mount
  useEffect(() => {
    if (typeof window === "undefined") return
    if (window.matchMedia("(max-width: 960px)").matches) {
      setFileTreeOpen(false)
    }
  }, [])

  const toggleFileTree = useCallback(() => setFileTreeOpen((v) => !v), [])

  const toggleSection = useCallback((key: string) => {
    setExpanded((prev) => ({ ...prev, [key]: !prev[key] }))
  }, [])

  // Tab operations
  const openTab = useCallback((tab: Tab) => {
    setTabs((prev) => {
      const existing = prev.find((t) => t.id === tab.id)
      if (existing) return prev
      return [...prev, tab]
    })
    setActiveTabId(tab.id)
  }, [])

  const closeTab = useCallback(
    (id: string) => {
      const current = tabsRef.current
      const idx = current.findIndex((t) => t.id === id)
      if (idx === -1) return
      const next = current.filter((t) => t.id !== id)
      setTabs(next)
      if (id === activeTabId && next.length > 0) {
        const adjacent = next[Math.max(0, idx - 1)]
        setActiveTabId(adjacent.id)
        routerRef.current.push(adjacent.href)
      }
    },
    [activeTabId]
  )

  const switchTab = useCallback((id: string) => {
    setActiveTabId(id)
  }, [])

  // Auto open tab on route change
  useEffect(() => {
    const handleRouteChange = (url: string) => {
      if (typeof window === "undefined") return
      if (window.matchMedia("(max-width: 960px)").matches) {
        setFileTreeOpen(false)
      }
    }
    router.events.on("routeChangeStart", handleRouteChange)
    return () => router.events.off("routeChangeStart", handleRouteChange)
  }, [router])

  // ⌘Shift+W / Ctrl+Shift+W — close active tab
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.shiftKey && e.key === "w") {
        e.preventDefault()
        const current = tabsRef.current
        const active = current.find((t) => t.id === activeTabId)
        if (!active?.closeable) return
        const idx = current.findIndex((t) => t.id === activeTabId)
        const next = current.filter((t) => t.id !== activeTabId)
        setTabs(next)
        if (next.length > 0) {
          const adjacent = next[Math.max(0, idx - 1)]
          setActiveTabId(adjacent.id)
          routerRef.current.push(adjacent.href)
        }
      }
    }
    window.addEventListener("keydown", handler)
    return () => window.removeEventListener("keydown", handler)
  }, [activeTabId])

  return (
    <RouteChromeContext.Provider
      value={{
        tabs,
        activeTabId,
        openTab,
        closeTab,
        switchTab,
        chrome,
        setChrome,
        isFileTreeOpen,
        setFileTreeOpen,
        toggleFileTree,
        expanded,
        toggleSection,
      }}
    >
      {children}
    </RouteChromeContext.Provider>
  )
}

// ---------------------------------------------------------------------------
// Legacy helper — call this in route components to register status bar items.
// Pass a memoized statusItems array (useMemo) to avoid extra renders.
// ---------------------------------------------------------------------------

export const useRegisterChrome = (filename: string, statusItems: string[]) => {
  const { setChrome, openTab } = useRouteChrome()
  const router = useRouter()
  const key = filename + "|" + statusItems.join("\0")

  useEffect(() => {
    setChrome({ filename, statusItems })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, setChrome])

  // Also open (or activate) a tab for the current route
  useEffect(() => {
    if (!filename) return
    // README is always the first, non-closeable tab
    if (filename === "README.md") {
      openTab(README_TAB)
      return
    }
    const href = router.asPath
    const kind: TabKind = filename.endsWith(".md") ? "post" : "page"
    openTab({
      id: href,
      kind,
      label: filename,
      href,
      closeable: true,
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key])
}
