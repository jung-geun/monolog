import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  ReactNode,
  useRef,
} from "react"
import { useRouter } from "next/compat/router"
import {
  CLOSED_POST_LIMIT,
  README_TAB,
  TAB_CONSENT_KEY,
  TAB_SESSION_KEY,
  isLocalTabHref,
  parseTabSession,
  serializeTabSession,
} from "./tabSessionStorage"

export type TabKind = "readme" | "post" | "category" | "series" | "graph" | "about" | "page" | "error"

export type Tab = {
  id: string
  kind: TabKind
  label: string
  href: string
  closeable: boolean
  preview?: boolean
}

export type TabStorageConsent = "loading" | "prompt" | "enabled" | "disabled" | "unavailable"

type TabSession = { tabs: Tab[]; activeTabId: string; closedPosts: Tab[] }

export type ChromeConfig = {
  filename: string
  statusItems: string[]
}

const defaultChrome: ChromeConfig = {
  filename: "Welcome",
  statusItems: [],
}

export type RouteChromeContextValue = {
  tabs: Tab[]
  activeTabId: string
  openTab: (tab: Tab) => void
  previewPost: (tab: Tab) => void
  pinTab: (id: string) => void
  previewTabId: string | null
  closeTab: (id: string) => void
  switchTab: (id: string) => void
  moveTab: (id: string, beforeId: string | null) => void
  closeActivePost: () => void
  reopenLastPost: () => void
  canReopenPost: boolean
  tabStorageConsent: TabStorageConsent
  allowTabStorage: () => void
  disallowTabStorage: () => void
  chrome: ChromeConfig
  setChrome: (config: ChromeConfig) => void
  isFileTreeOpen: boolean
  setFileTreeOpen: (open: boolean) => void
  toggleFileTree: () => void
  expanded: Record<string, boolean>
  toggleSection: (key: string) => void
}

const defaultExpanded: Record<string, boolean> = {
  openEditors: false,
  workspace: true,
  posts: true,
  categories: false,
  series: false,
  projects: false,
  public: false,
}

const RouteChromeContext = createContext<RouteChromeContextValue>({
  tabs: [README_TAB],
  activeTabId: "readme",
  openTab: () => {},
  previewPost: () => {},
  pinTab: () => {},
  previewTabId: null,
  closeTab: () => {},
  switchTab: () => {},
  moveTab: () => {},
  closeActivePost: () => {},
  reopenLastPost: () => {},
  canReopenPost: false,
  tabStorageConsent: "loading",
  allowTabStorage: () => {},
  disallowTabStorage: () => {},
  chrome: defaultChrome,
  setChrome: () => {},
  isFileTreeOpen: true,
  setFileTreeOpen: () => {},
  toggleFileTree: () => {},
  expanded: defaultExpanded,
  toggleSection: () => {},
})

export const useRouteChrome = () => useContext(RouteChromeContext)

export const RouteChromeProvider = ({ children }: { children: ReactNode }) => {
  const router = useRouter()
  const [chrome, setChrome] = useState<ChromeConfig>(defaultChrome)
  const [sidebarOpen, setSidebarOpen] = useState({ desktop: true, mobile: false })
  const [mobileViewport, setMobileViewport] = useState(false)
  const isFileTreeOpen = sidebarOpen[mobileViewport ? "mobile" : "desktop"]
  const setFileTreeOpen = useCallback((open: boolean) => {
    const viewport = window.matchMedia("(max-width: 960px)").matches ? "mobile" : "desktop"
    setSidebarOpen(previous => ({ ...previous, [viewport]: open }))
  }, [])
  const [expanded, setExpanded] = useState<Record<string, boolean>>(defaultExpanded)
  const [session, setSession] = useState<TabSession>({ tabs: [README_TAB], activeTabId: "readme", closedPosts: [] })
  const [tabStorageConsent, setTabStorageConsent] = useState<TabStorageConsent>("loading")
  const routerRef = useRef(router)
  const sessionRef = useRef(session)
  const consentRef = useRef<TabStorageConsent>("loading")
  const initializedRef = useRef(false)
  const previewNavigationRef = useRef<string | null>(null)

  useEffect(() => {
    routerRef.current = router
  }, [router])

  // Update the authoritative ref synchronously in actions, never in a state
  // updater. Two actions in one event see each other's result, and navigation
  // cannot be repeated by React's replay of an updater.
  const updateSession = useCallback((next: TabSession) => {
    sessionRef.current = next
    setSession(next)
  }, [])

  useEffect(() => {
    if (initializedRef.current) return
    initializedRef.current = true
    try {
      if (window.localStorage.getItem(TAB_CONSENT_KEY) !== "enabled") {
        consentRef.current = "prompt"
        setTabStorageConsent("prompt")
        return
      }
      const raw = window.localStorage.getItem(TAB_SESSION_KEY)
      const restored = raw ? parseTabSession(raw) : null
      if (restored) {
        const current = sessionRef.current
        const tabs = [...restored.tabs]
        if (!tabs.some((tab) => tab.id === "readme")) tabs.unshift(README_TAB)
        for (const tab of current.tabs) {
          const index = tabs.findIndex((entry) => entry.id === tab.id)
          if (index < 0) tabs.push(tab)
          else tabs[index] = tab
        }
        const routeTab = tabs.find((tab) => tab.id === current.activeTabId && tab.href === routerRef.current?.asPath)
          ?? tabs.find((tab) => tab.href === routerRef.current?.asPath)
        updateSession({ tabs, activeTabId: routeTab?.id ?? current.activeTabId, closedPosts: restored.closedPosts })
      }
      consentRef.current = "enabled"
      setTabStorageConsent("enabled")
    } catch {
      consentRef.current = "unavailable"
      setTabStorageConsent("unavailable")
    }
  }, [updateSession])

  useEffect(() => {
    if (tabStorageConsent !== "enabled" || consentRef.current !== "enabled") return
    try {
      // A different window may have revoked consent since this provider
      // hydrated. Check before writing even if its storage event is queued.
      if (window.localStorage.getItem(TAB_CONSENT_KEY) !== "enabled") {
        consentRef.current = "disabled"
        setTabStorageConsent("disabled")
        return
      }
      window.localStorage.setItem(TAB_SESSION_KEY, serializeTabSession(sessionRef.current))
    } catch {
      consentRef.current = "unavailable"
      setTabStorageConsent("unavailable")
    }
  }, [session, tabStorageConsent])

  useEffect(() => {
    const handleStorage = (event: StorageEvent) => {
      if (event.key !== TAB_CONSENT_KEY && event.key !== null) return
      if (event.newValue === "enabled") return
      try {
        if (event.storageArea && event.storageArea !== window.localStorage) return
        consentRef.current = "disabled"
        setTabStorageConsent("disabled")
      } catch {
        consentRef.current = "unavailable"
        setTabStorageConsent("unavailable")
      }
    }
    window.addEventListener("storage", handleStorage)
    return () => window.removeEventListener("storage", handleStorage)
  }, [])

  const allowTabStorage = useCallback(() => {
    if (!initializedRef.current) return
    try {
      window.localStorage.setItem(TAB_CONSENT_KEY, "enabled")
      consentRef.current = "enabled"
      setTabStorageConsent("enabled")
    } catch {
      consentRef.current = "unavailable"
      setTabStorageConsent("unavailable")
    }
  }, [])

  const disallowTabStorage = useCallback(() => {
    const hadConsent = consentRef.current === "enabled" || consentRef.current === "unavailable"
    consentRef.current = "disabled"
    setTabStorageConsent("disabled")
    if (!hadConsent) return
    for (const key of [TAB_CONSENT_KEY, TAB_SESSION_KEY]) {
      try {
        window.localStorage.removeItem(key)
      } catch {
        consentRef.current = "unavailable"
        setTabStorageConsent("unavailable")
      }
    }
  }, [])

  useEffect(() => {
    const media = window.matchMedia("(max-width: 960px)")
    const resize = () => setMobileViewport(media.matches)
    resize()
    media.addEventListener("change", resize)
    return () => media.removeEventListener("change", resize)
  }, [])

  const toggleFileTree = useCallback(() => {
    const viewport = window.matchMedia("(max-width: 960px)").matches ? "mobile" : "desktop"
    setSidebarOpen(previous => ({ ...previous, [viewport]: !previous[viewport] }))
  }, [])
  const toggleSection = useCallback((key: string) => {
    setExpanded((prev) => ({ ...prev, [key]: !prev[key] }))
  }, [])

  const openTab = useCallback((tab: Tab) => {
    if (!isLocalTabHref(tab.href)) return
    if (tab.kind === "readme" || tab.id === "readme") tab = README_TAB
    const current = sessionRef.current
    const tabs = tab.kind === "readme"
      ? current.tabs.filter((entry) => entry.kind !== "error" || entry.href.split(/[?#]/, 1)[0] !== "/")
      : [...current.tabs]
    const index = tabs.findIndex((entry) => entry.id === tab.id)
    if (index < 0) tabs.push(tab)
    else tabs[index] = { ...tab, preview: tabs[index].preview }
    updateSession({ ...current, tabs, activeTabId: tab.id })
  }, [updateSession])

  const pinTab = useCallback((id: string) => {
    const current = sessionRef.current
    updateSession({ ...current, tabs: current.tabs.map((tab) => tab.id === id ? { ...tab, preview: false } : tab) })
  }, [updateSession])

  const previewPost = useCallback((tab: Tab) => {
    if (tab.kind !== "post" || !isLocalTabHref(tab.href)) return
    const current = sessionRef.current
    const existing = current.tabs.find((entry) => entry.id === tab.id)
    const tabs = existing
      ? current.tabs
      : [...current.tabs.filter((entry) => !entry.preview), { ...tab, preview: true }]
    const next = { ...current, tabs, activeTabId: tab.id }
    updateSession(next)
    previewNavigationRef.current = tab.href
    const navigation = routerRef.current?.push(tab.href, undefined, { scroll: false })
    navigation?.then((completed) => {
      if (!completed && sessionRef.current === next) updateSession(current)
    }).catch(() => {
      if (sessionRef.current === next) updateSession(current)
    })
  }, [updateSession])

  const closeTab = useCallback((id: string) => {
    const current = sessionRef.current
    const index = current.tabs.findIndex((tab) => tab.id === id)
    const tab = current.tabs[index]
    if (!tab || tab.kind === "readme" || !tab.closeable) return
    const tabs = current.tabs.filter((entry) => entry.id !== id)
    const adjacent = tabs[Math.max(0, index - 1)]
    const isActive = id === current.activeTabId
    const closedPosts = tab.kind === "post" && !tab.preview
      ? [...current.closedPosts.filter((entry) => entry.id !== id), tab].slice(-CLOSED_POST_LIMIT)
      : current.closedPosts
    updateSession({ tabs, activeTabId: isActive ? adjacent.id : current.activeTabId, closedPosts })
    if (isActive) routerRef.current?.push(adjacent.href)
  }, [updateSession])

  const closeActivePost = useCallback(() => {
    const current = sessionRef.current
    if (current.tabs.find((tab) => tab.id === current.activeTabId)?.kind === "post") closeTab(current.activeTabId)
  }, [closeTab])

  const reopenLastPost = useCallback(() => {
    const current = sessionRef.current
    const tab = current.closedPosts[current.closedPosts.length - 1]
    if (!tab) return
    updateSession({
      tabs: current.tabs.some((entry) => entry.id === tab.id) ? current.tabs : [...current.tabs, tab],
      activeTabId: tab.id,
      closedPosts: current.closedPosts.slice(0, -1),
    })
    routerRef.current?.push(tab.href)
  }, [updateSession])

  const switchTab = useCallback((id: string) => {
    const current = sessionRef.current
    const tab = current.tabs.find((entry) => entry.id === id)
    if (!tab) return
    if (tab.preview) previewNavigationRef.current = tab.href
    updateSession({ ...current, activeTabId: id })
  }, [updateSession])

  const moveTab = useCallback((id: string, beforeId: string | null) => {
    const current = sessionRef.current
    const from = current.tabs.findIndex((tab) => tab.id === id)
    const target = beforeId === null ? current.tabs.length : current.tabs.findIndex((tab) => tab.id === beforeId)
    if (from < 0 || target < 0 || id === beforeId) return
    const to = target - (from < target ? 1 : 0)
    if (from === to) return
    const tabs = [...current.tabs]
    const [tab] = tabs.splice(from, 1)
    tabs.splice(to, 0, tab)
    updateSession({ ...current, tabs })
  }, [updateSession])

  useEffect(() => {
    if (!router) return
    const handleRouteChange = (url: string) => {
      if (previewNavigationRef.current === url) previewNavigationRef.current = null
      else {
        previewNavigationRef.current = null
        const target = sessionRef.current.tabs.find((tab) => tab.id === url.split("#", 1)[0])
        if (target?.preview) pinTab(target.id)
      }
      if (window.matchMedia("(max-width: 960px)").matches) setFileTreeOpen(false)
    }
    router.events.on("routeChangeStart", handleRouteChange)
    return () => router.events.off("routeChangeStart", handleRouteChange)
  }, [router, pinTab, setFileTreeOpen])

  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      if (event.repeat || event.isComposing) return
      const target = event.target
      if (target instanceof Element && target.closest('input, textarea, select, [contenteditable]:not([contenteditable="false"]), [role="textbox"]')) return
      const fallback = event.altKey && !event.metaKey && !event.ctrlKey
      // Only app alternatives: never intercept browser close/reopen commands.
      const close = !event.shiftKey && fallback && event.code === "KeyW"
      const reopen = event.shiftKey && fallback && event.code === "KeyT"
      if (close && sessionRef.current.tabs.find((tab) => tab.id === sessionRef.current.activeTabId)?.kind === "post") {
        event.preventDefault()
        closeActivePost()
      } else if (reopen && sessionRef.current.closedPosts.length > 0) {
        event.preventDefault()
        reopenLastPost()
      }
    }
    window.addEventListener("keydown", handler)
    return () => window.removeEventListener("keydown", handler)
  }, [closeActivePost, reopenLastPost])

  return (
    <RouteChromeContext.Provider
      value={{
        tabs: session.tabs,
        activeTabId: session.activeTabId,
        openTab,
        previewPost,
        pinTab,
        previewTabId: session.tabs.find((tab) => tab.preview)?.id ?? null,
        closeTab,
        switchTab,
        moveTab,
        closeActivePost,
        reopenLastPost,
        canReopenPost: session.closedPosts.length > 0,
        tabStorageConsent,
        allowTabStorage,
        disallowTabStorage,
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

// Route metadata is authoritative: a Markdown-looking label is not proof of a
// post. An empty filename defers registration while detail metadata loads.
export const useRegisterChrome = (filename: string, statusItems: string[], kind: TabKind) => {
  const { setChrome, openTab } = useRouteChrome()
  const router = useRouter()
  const href = router?.asPath
  const key = filename + "|" + statusItems.join("\0")
  const registeredRouteRef = useRef<{ filename: string; kind: TabKind; href: string } | null>(null)

  useEffect(() => {
    if (filename) setChrome({ filename, statusItems })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, setChrome])

  // Anchors belong to the same document tab; retain the complete entry URL for reopening.
  useEffect(() => {
    if (!filename || !href) return
    const documentHref = href.split("#", 1)[0]
    const previous = registeredRouteRef.current
    if (previous?.filename === filename && previous.kind === kind && previous.href === documentHref) return
    registeredRouteRef.current = { filename, kind, href: documentHref }
    openTab(kind === "readme" ? README_TAB : { id: documentHref, kind, label: filename, href, closeable: true })
  }, [filename, href, kind, openTab])
}
