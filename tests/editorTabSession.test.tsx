import React, { act, useEffect } from "react"
import { createRoot, type Root } from "react-dom/client"
import {
  RouteChromeProvider,
  useRegisterChrome,
  useRouteChrome,
  type Tab,
  type TabKind,
  type RouteChromeContextValue,
} from "src/layouts/RootLayout/EditorChrome/RouteChromeContext"
import { TAB_CONSENT_KEY, TAB_SESSION_KEY } from "src/layouts/RootLayout/EditorChrome/tabSessionStorage"

const mockRouter = {
  asPath: "/",
  push: jest.fn(),
  events: { on: jest.fn(), off: jest.fn() },
}
jest.mock("next/compat/router", () => ({ useRouter: () => mockRouter }))

;(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true

const statusItems = ["main"]
const Document = ({ filename, kind }: { filename: string; kind: TabKind }) => {
  useRegisterChrome(filename, statusItems, kind)
  return null
}
let chrome: RouteChromeContextValue
const Probe = () => {
  const value = useRouteChrome()
  useEffect(() => { chrome = value }, [value])
  return <output>{value.tabs.map((tab) => tab.label).join("|")}</output>
}
const post = (href: string, kind: TabKind = "post"): Tab => ({ id: href.split("#", 1)[0], kind, href, label: `${href.slice(1).split(/[?#]/)[0]}.md`, closeable: true })
const snapshot = (tabs: Tab[], closedPosts: Tab[] = []) => JSON.stringify({ version: 1, tabs, closedPosts })

describe("editor tab sessions", () => {
  let container: HTMLDivElement
  let root: Root
  let storageDescriptor: PropertyDescriptor | undefined
  let originalStorage: Storage
  let filename: string
  let kind: TabKind

  const render = () => {
    act(() => root.render(
      <React.StrictMode>
        <RouteChromeProvider>
          <Document filename={filename} kind={kind} />
          <Probe />
        </RouteChromeProvider>
      </React.StrictMode>
    ))
  }
  const navigate = (href: string, nextKind: TabKind = "post", nextFilename = post(href).label) => {
    mockRouter.asPath = href
    filename = nextFilename
    kind = nextKind
    render()
  }
  const remount = () => {
    act(() => root.unmount())
    root = createRoot(container)
    render()
  }
  const keydown = (init: KeyboardEventInit, target: EventTarget = window) => {
    const event = new KeyboardEvent("keydown", { bubbles: true, cancelable: true, ...init })
    act(() => { target.dispatchEvent(event) })
    return event
  }

  beforeEach(() => {
    storageDescriptor = Object.getOwnPropertyDescriptor(window, "localStorage")
    originalStorage = window.localStorage
    originalStorage.removeItem(TAB_CONSENT_KEY)
    originalStorage.removeItem(TAB_SESSION_KEY)
    mockRouter.asPath = "/"
    filename = "README.md"
    kind = "readme"
    container = document.createElement("div")
    document.body.appendChild(container)
    root = createRoot(container)
  })
  afterEach(() => {
    act(() => root.unmount())
    container.remove()
    jest.restoreAllMocks()
    if (storageDescriptor) Object.defineProperty(window, "localStorage", storageDescriptor)
    originalStorage.removeItem(TAB_CONSENT_KEY)
    originalStorage.removeItem(TAB_SESSION_KEY)
    jest.clearAllMocks()
  })

  it("closes inactive tabs without navigation and active posts toward the left adjacent route", () => {
    render()
    navigate("/alpha")
    navigate("/beta")
    navigate("/gamma?view=notes#part")
    act(() => chrome.closeTab("/alpha"))
    expect(chrome.tabs.map((tab) => tab.id)).toEqual(["readme", "/beta", "/gamma?view=notes"])
    expect(chrome.activeTabId).toBe("/gamma?view=notes")
    expect(mockRouter.push).not.toHaveBeenCalled()
    act(() => {
      chrome.closeActivePost()
      chrome.closeTab("/gamma?view=notes")
    })
    expect(chrome.activeTabId).toBe("/beta")
    expect(mockRouter.push.mock.calls).toEqual([["/beta"]])
    act(() => chrome.closeTab("readme"))
    expect(chrome.tabs.map((tab) => tab.id)).toEqual(["readme", "/beta"])
  })

  it("consumes closed posts in LIFO order, reopening exact URLs once without duplicating an already open post", () => {
    render()
    navigate("/alpha?mode=one#part")
    navigate("/beta#end")
    act(() => {
      chrome.closeTab("/alpha?mode=one")
      chrome.closeTab("/beta")
      chrome.openTab(post("/beta#end"))
    })
    mockRouter.push.mockClear()
    act(() => {
      chrome.reopenLastPost()
      chrome.reopenLastPost()
      chrome.reopenLastPost()
    })
    expect(chrome.tabs.map((tab) => tab.id)).toEqual(["readme", "/beta", "/alpha?mode=one"])
    expect(mockRouter.push.mock.calls).toEqual([["/beta#end"], ["/alpha?mode=one#part"]])
    expect(chrome.canReopenPost).toBe(false)
  })

  it.each<TabKind>(["readme", "page", "about", "graph", "category", "series"])("does not treat %s documents as posts", (documentKind) => {
    render()
    if (documentKind !== "readme") navigate(`/${documentKind}`, documentKind)
    const originalIds = chrome.tabs.map((tab) => tab.id)
    act(() => chrome.closeActivePost())
    expect(chrome.tabs.map((tab) => tab.id)).toEqual(originalIds)
    expect(keydown({ code: "KeyW", key: "∑", altKey: true }).defaultPrevented).toBe(false)
    expect(mockRouter.push).not.toHaveBeenCalled()
    act(() => chrome.closeTab(chrome.activeTabId))
    expect(chrome.canReopenPost).toBe(false)
  })

  it("keeps same-document hash navigation in one tab while preserving query-specific documents", () => {
    render()
    navigate("/alpha?view=notes#first")
    act(() => chrome.allowTabStorage())
    navigate("/alpha?view=notes#second")
    navigate("/alpha?view=notes")
    expect(chrome.tabs.map((tab) => tab.id)).toEqual(["readme", "/alpha?view=notes"])
    expect(chrome.activeTabId).toBe("/alpha?view=notes")
    expect(JSON.parse(originalStorage.getItem(TAB_SESSION_KEY)!).tabs.map((tab: Tab) => tab.href)).toEqual(["/", "/alpha?view=notes#first"])
    remount()
    expect(chrome.tabs.map((tab) => tab.id)).toEqual(["readme", "/alpha?view=notes"])
    expect(chrome.activeTabId).toBe("/alpha?view=notes")
    navigate("/alpha?view=raw#second")
    expect(chrome.tabs.map((tab) => tab.id)).toEqual(["readme", "/alpha?view=notes", "/alpha?view=raw"])
    act(() => chrome.closeActivePost())
    expect(chrome.activeTabId).toBe("/alpha?view=notes")
    act(() => chrome.reopenLastPost())
    expect(mockRouter.push.mock.calls).toEqual([["/alpha?view=notes"], ["/alpha?view=raw#second"]])
    expect(chrome.canReopenPost).toBe(false)
  })

  it("defers detail registration until metadata is available and updates the explicit kind", () => {
    render()
    navigate("/about", "post", "")
    expect(chrome.tabs.map((tab) => tab.id)).toEqual(["readme"])
    navigate("/about", "about", "about.md")
    expect(chrome.tabs.find((tab) => tab.id === "/about")?.kind).toBe("about")
    act(() => chrome.closeActivePost())
    expect(chrome.activeTabId).toBe("/about")
    expect(mockRouter.push).not.toHaveBeenCalled()
  })

  it("uses physical Option codes and best-effort browser commands, not the window-close shortcut", () => {
    render()
    navigate("/alpha")
    expect(keydown({ code: "KeyW", key: "W", metaKey: true, shiftKey: true }).defaultPrevented).toBe(false)
    expect(keydown({ code: "KeyW", key: "∑", altKey: true }).defaultPrevented).toBe(true)
    expect(chrome.activeTabId).toBe("readme")
    expect(keydown({ code: "KeyT", key: "ˇ", altKey: true, shiftKey: true }).defaultPrevented).toBe(true)
    expect(chrome.activeTabId).toBe("/alpha")
    expect(keydown({ key: "w", ctrlKey: true }).defaultPrevented).toBe(true)
    expect(keydown({ key: "T", metaKey: true, shiftKey: true }).defaultPrevented).toBe(true)
    expect(mockRouter.push.mock.calls).toEqual([["/"], ["/alpha"], ["/"], ["/alpha"]])
  })

  it("ignores editable targets, repeat and composition, and removes its listener on unmount", () => {
    render()
    navigate("/alpha")
    for (const element of ["input", "textarea", "select", "div"]) {
      const target = document.createElement(element)
      if (element === "div") target.setAttribute("contenteditable", "true")
      container.appendChild(target)
      keydown({ code: "KeyW", key: "∑", altKey: true }, target)
      target.remove()
    }
    keydown({ code: "KeyW", key: "∑", altKey: true, repeat: true })
    keydown({ code: "KeyW", key: "∑", altKey: true, isComposing: true })
    expect(chrome.activeTabId).toBe("/alpha")
    expect(mockRouter.push).not.toHaveBeenCalled()
    act(() => root.unmount())
    root = createRoot(container)
    expect(keydown({ code: "KeyW", key: "∑", altKey: true }).defaultPrevented).toBe(false)
    expect(mockRouter.push).not.toHaveBeenCalled()
  })

  it("never reads a session or writes preferences before affirmative consent; decline remains memory-only", () => {
    originalStorage.setItem(TAB_SESSION_KEY, snapshot([post("/old")]))
    const reads = jest.spyOn(Storage.prototype, "getItem")
    const writes = jest.spyOn(Storage.prototype, "setItem")
    render()
    navigate("/alpha")
    expect(reads.mock.calls).toEqual([[TAB_CONSENT_KEY]])
    expect(chrome.tabs.map((tab) => tab.id)).toEqual(["readme", "/alpha"])
    act(() => chrome.disallowTabStorage())
    navigate("/beta")
    act(() => chrome.closeActivePost())
    expect(writes).not.toHaveBeenCalled()
    expect(chrome.tabStorageConsent).toBe("disabled")
    remount()
    expect(chrome.tabStorageConsent).toBe("prompt")
    expect(chrome.tabs.some((tab) => tab.id === "/alpha")).toBe(false)
  })

  it("persists minimal metadata after consent and restores other tabs and closed history without replacing the current deep link", () => {
    render()
    navigate("/alpha")
    navigate("/beta?mode=two#end")
    act(() => chrome.closeTab("/alpha"))
    const writes = jest.spyOn(Storage.prototype, "setItem")
    act(() => chrome.allowTabStorage())
    expect(originalStorage.getItem(TAB_CONSENT_KEY)).toBe("enabled")
    const saved = JSON.parse(originalStorage.getItem(TAB_SESSION_KEY)!)
    expect(saved).toEqual({
      version: 1,
      tabs: [
        { id: "readme", kind: "readme", label: "README.md", href: "/" },
        { id: "/beta?mode=two", kind: "post", label: "beta.md", href: "/beta?mode=two#end" },
      ],
      closedPosts: [{ id: "/alpha", kind: "post", label: "alpha.md", href: "/alpha" }],
    })
    writes.mockClear()
    mockRouter.asPath = "/deep?fresh=yes#now"
    filename = "fresh.md"
    remount()
    expect(chrome.activeTabId).toBe("/deep?fresh=yes")
    expect(chrome.tabs.map((tab) => tab.id)).toEqual(["readme", "/beta?mode=two", "/deep?fresh=yes"])
    expect(mockRouter.push).not.toHaveBeenCalled()
    // Every post-hydration write must retain the saved tab, including the first.
    for (const [key, raw] of writes.mock.calls) {
      if (key === TAB_SESSION_KEY) expect(JSON.parse(raw).tabs.map((tab: Tab) => tab.id)).toContain("/beta?mode=two")
    }
    expect(chrome.canReopenPost).toBe(true)
    act(() => chrome.reopenLastPost())
    expect(mockRouter.push.mock.calls).toEqual([["/alpha"]])
    expect(chrome.canReopenPost).toBe(false)
  })

  it("merges fresh route metadata over the restored tab for the same href", () => {
    originalStorage.setItem(TAB_CONSENT_KEY, "enabled")
    originalStorage.setItem(TAB_SESSION_KEY, snapshot([post("/alpha"), post("/about")]))
    mockRouter.asPath = "/about"
    filename = "about.md"
    kind = "about"
    render()
    expect(chrome.activeTabId).toBe("/about")
    expect(chrome.tabs.map((tab) => [tab.id, tab.kind])).toEqual([["readme", "readme"], ["/alpha", "post"], ["/about", "about"]])
    act(() => chrome.closeActivePost())
    expect(mockRouter.push).not.toHaveBeenCalled()
  })

  it("revokes both stored keys while preserving memory tabs and stops all later session writes", () => {
    render()
    navigate("/alpha")
    act(() => chrome.allowTabStorage())
    const writes = jest.spyOn(Storage.prototype, "setItem")
    writes.mockClear()
    act(() => chrome.disallowTabStorage())
    expect(originalStorage.getItem(TAB_CONSENT_KEY)).toBeNull()
    expect(originalStorage.getItem(TAB_SESSION_KEY)).toBeNull()
    expect(chrome.tabs.map((tab) => tab.id)).toEqual(["readme", "/alpha"])
    navigate("/beta")
    act(() => {
      chrome.closeActivePost()
      chrome.reopenLastPost()
    })
    expect(writes).not.toHaveBeenCalled()
    expect(chrome.tabStorageConsent).toBe("disabled")
  })

  it("ignores a non-enabled preference even when a saved session exists", () => {
    originalStorage.setItem(TAB_CONSENT_KEY, "disabled")
    originalStorage.setItem(TAB_SESSION_KEY, snapshot([post("/old")]))
    const reads = jest.spyOn(Storage.prototype, "getItem")
    const writes = jest.spyOn(Storage.prototype, "setItem")
    render()
    expect(chrome.tabs.map((tab) => tab.id)).toEqual(["readme"])
    expect(reads.mock.calls).toEqual([[TAB_CONSENT_KEY]])
    navigate("/fresh")
    expect(writes).not.toHaveBeenCalled()
  })

  it.each([
    "broken JSON",
    JSON.stringify({ version: 2, tabs: [], closedPosts: [] }),
    snapshot([post("https://evil.example/steal")]),
    snapshot([post("javascript:alert(1)")]),
    snapshot([post("//evil.example/steal")]),
    snapshot([post("/\\evil.example/steal")]),
    snapshot([post("/duplicate"), post("/duplicate")]),
    snapshot([{ id: "readme", kind: "readme", label: "README.md", href: "/evil", closeable: true }]),
    snapshot([post("/alpha")], [post("/graph", "graph")]),
    snapshot([post("/alpha")], [post("/old"), post("/old")]),
    snapshot([{ ...post("/alpha"), id: "/different" }]),
  ])("rejects corrupted or untrusted saved sessions: %s", (raw) => {
    originalStorage.setItem(TAB_CONSENT_KEY, "enabled")
    originalStorage.setItem(TAB_SESSION_KEY, raw)
    mockRouter.asPath = "/safe"
    filename = "safe.md"
    kind = "post"
    render()
    expect(chrome.tabs.map((tab) => tab.id)).toEqual(["readme", "/safe"])
    expect(chrome.canReopenPost).toBe(false)
    act(() => chrome.reopenLastPost())
    expect(mockRouter.push).not.toHaveBeenCalled()
  })

  it("handles a blocked storage getter without breaking tab navigation", () => {
    Object.defineProperty(window, "localStorage", { configurable: true, get: () => { throw new DOMException("Blocked", "SecurityError") } })
    render()
    expect(chrome.tabStorageConsent).toBe("unavailable")
    navigate("/alpha")
    act(() => chrome.closeActivePost())
    expect(mockRouter.push.mock.calls).toEqual([["/"]])
    expect(chrome.canReopenPost).toBe(true)
    act(() => chrome.allowTabStorage())
    expect(chrome.tabStorageConsent).toBe("unavailable")
  })

  it("stops persistence after a quota error while keeping current tabs usable", () => {
    render()
    navigate("/alpha")
    const writes = jest.spyOn(Storage.prototype, "setItem").mockImplementation(() => { throw new DOMException("Full", "QuotaExceededError") })
    act(() => chrome.allowTabStorage())
    expect(chrome.tabStorageConsent).toBe("unavailable")
    writes.mockClear()
    navigate("/beta")
    act(() => chrome.closeActivePost())
    expect(writes).not.toHaveBeenCalled()
    expect(chrome.tabs.map((tab) => tab.id)).toEqual(["readme", "/alpha"])
    expect(mockRouter.push.mock.calls).toEqual([["/alpha"]])
  })

  it("keeps tab operations in memory after an enabled session write fails", () => {
    render()
    navigate("/alpha")
    act(() => chrome.allowTabStorage())
    const writes = jest.spyOn(Storage.prototype, "setItem").mockImplementation(() => { throw new DOMException("Full", "QuotaExceededError") })
    navigate("/beta")
    expect(chrome.tabStorageConsent).toBe("unavailable")
    writes.mockClear()
    act(() => {
      chrome.closeActivePost()
      chrome.reopenLastPost()
    })
    expect(chrome.activeTabId).toBe("/beta")
    expect(writes).not.toHaveBeenCalled()
    expect(mockRouter.push.mock.calls).toEqual([["/alpha"], ["/beta"]])
  })

  it("bounds the reopen history to the most recent twenty posts", () => {
    render()
    act(() => {
      for (let index = 0; index < 21; index++) {
        const tab = post(`/post-${index}`)
        chrome.openTab(tab)
        chrome.closeTab(tab.id)
      }
    })
    mockRouter.push.mockClear()
    act(() => {
      for (let index = 0; index < 21; index++) chrome.reopenLastPost()
    })
    expect(mockRouter.push.mock.calls).toEqual(Array.from({ length: 20 }, (_, index) => [`/post-${20 - index}`]))
    expect(chrome.tabs.map((tab) => tab.id)).toEqual(["readme", ...Array.from({ length: 20 }, (_, index) => `/post-${20 - index}`)])
    expect(chrome.canReopenPost).toBe(false)
  })
})
