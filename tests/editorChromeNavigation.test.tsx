import React, { act } from "react"
import { createRoot, type Root } from "react-dom/client"
import { ThemeProvider } from "@emotion/react"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { RouterContext } from "next/dist/shared/lib/router-context.shared-runtime"
import type { NextRouter } from "next/router"
import ActivityBar from "src/layouts/RootLayout/EditorChrome/ActivityBar"
import FileTree from "src/layouts/RootLayout/EditorChrome/FileTree"
import TabBar from "src/layouts/RootLayout/EditorChrome/TabBar"
import {
  RouteChromeProvider,
  useRegisterChrome,
  type TabKind,
} from "src/layouts/RootLayout/EditorChrome/RouteChromeContext"
import { queryKey } from "src/constants/queryKey"
import { createTheme } from "src/styles/theme"
import type { PostDetail, TPost } from "src/types"

const mockRouter = {
  pathname: "/",
  asPath: "/",
  query: {} as Record<string, string>,
  push: jest.fn(),
  prefetch: jest.fn().mockResolvedValue(undefined),
  beforePopState: jest.fn(),
  events: { on: jest.fn(), off: jest.fn() },
}

jest.mock("next/compat/router", () => ({ useRouter: () => mockRouter }))

;(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true

const makePost = (slug: string, overrides: Partial<TPost> = {}): TPost => ({
  id: `id-${slug}`,
  title: `Title ${slug}`,
  slug,
  status: ["Public"],
  type: ["Post"],
  date: { start_date: "2026-01-01" },
  createdTime: "2026-01-01T00:00:00.000Z",
  fullWidth: false,
  ...overrides,
})

// Feed is newest first: p01 … p15 are recent, p16 and p17 are older.
const feed = Array.from({ length: 17 }, (_, i) => makePost(`p${String(i + 1).padStart(2, "0")}`))
const detail = (post: TPost): PostDetail => ({ ...post, recordMap: {} as PostDetail["recordMap"] })

const statusItems = ["main"]
const Document = ({ filename, kind }: { filename: string; kind: TabKind }) => {
  useRegisterChrome(filename, statusItems, kind)
  return null
}

describe("editor chrome navigation", () => {
  let container: HTMLDivElement
  let root: Root
  let client: QueryClient
  let filename = "README.md"
  let kind: TabKind = "readme"

  const render = () =>
    act(() =>
      root.render(
        <QueryClientProvider client={client}>
          <RouterContext.Provider value={mockRouter as unknown as NextRouter}>
          <ThemeProvider theme={createTheme({ scheme: "dark" })}>
            <RouteChromeProvider>
              <ActivityBar />
              <FileTree />
              <TabBar preferencesOpen={false} onTogglePreferences={() => {}} />
              <Document key={mockRouter.asPath} filename={filename} kind={kind} />
            </RouteChromeProvider>
          </ThemeProvider>
          </RouterContext.Provider>
        </QueryClientProvider>
      )
    )

  const navigate = (asPath: string, nextFilename: string, pathname = "/[slug]", nextKind: TabKind = "post") => {
    mockRouter.asPath = asPath
    mockRouter.pathname = pathname
    const slug = asPath.split(/[?#]/)[0].slice(1)
    mockRouter.query = pathname === "/[slug]" ? { slug: decodeURIComponent(slug) } : {}
    filename = nextFilename
    kind = nextKind
    render()
  }

  const postEntries = () =>
    Array.from(container.querySelectorAll("#tree-section-posts a")).map((a) => a.textContent)
  const currentPostEntries = () =>
    Array.from(container.querySelectorAll('#tree-section-posts a[aria-current="page"]')).map(
      (a) => a.textContent
    )
  const closeTab = (label: string) => {
    const button = container.querySelector(`button[aria-label="${label} 닫기"]`) as HTMLButtonElement
    act(() => button.click())
  }
  const recentEntries = feed.slice(0, 15).map((post) => `◧${post.slug}.md`)

  beforeEach(() => {
    client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    client.setQueryData(queryKey.posts(), feed)
    container = document.createElement("div")
    document.body.appendChild(container)
    root = createRoot(container)
    mockRouter.pathname = "/"
    mockRouter.asPath = "/"
    mockRouter.query = {}
    filename = "README.md"
    kind = "readme"
  })

  afterEach(() => {
    act(() => root.unmount())
    container.remove()
    client.clear()
    jest.restoreAllMocks()
    jest.clearAllMocks()
  })

  it("reorders by drop midpoints and append without navigating, including README", () => {
    render()
    navigate("/p01", "p01.md")
    navigate("/p02", "p02.md")
    navigate("/p03", "p03.md")
    const order = () => Array.from(container.querySelectorAll<HTMLElement>(".tab-list [data-tab-id]"), (tab) => tab.dataset.tabId)
    const tab = (id: string) => container.querySelector<HTMLElement>(`.tab-list [data-tab-id="${id}"]`)!
    const list = container.querySelector<HTMLDivElement>(".tab-list")!
    const transfer = { clearData: jest.fn(), setData: jest.fn(), effectAllowed: "", dropEffect: "" }
    const drag = (target: Element, type: string, clientX = 0) => {
      const event = new MouseEvent(type, { bubbles: true, cancelable: true, clientX, clientY: 10 })
      Object.defineProperty(event, "dataTransfer", { value: transfer })
      act(() => { target.dispatchEvent(event) })
      return event
    }
    const geometry = () => {
      container.querySelectorAll<HTMLElement>(".tab-list [data-tab-id]").forEach((element, index) => {
        jest.spyOn(element, "getBoundingClientRect").mockReturnValue({ left: index * 100, right: (index + 1) * 100, top: 0, bottom: 32, width: 100, height: 32, x: index * 100, y: 0, toJSON: () => ({}) })
      })
    }
    geometry()
    drag(tab("/p01"), "dragstart")
    drag(list, "dragover", 320)
    drag(list, "drop", 320)
    expect(order()).toEqual(["readme", "/p02", "/p01", "/p03"])
    geometry()
    drag(tab("readme"), "dragstart")
    drag(list, "dragover", 380)
    drag(list, "drop", 380)
    expect(order()).toEqual(["/p02", "/p01", "/p03", "readme"])
    geometry()
    drag(tab("/p03"), "dragstart")
    drag(list, "drop", 70)
    expect(order()).toEqual(["/p02", "/p03", "/p01", "readme"])
    expect(container.querySelector(".tab.active")?.getAttribute("data-tab-id")).toBe("/p03")
    expect(mockRouter.push).not.toHaveBeenCalled()

    drag(list, "dragover", 0)
    drag(list, "drop", 0)
    expect(order()).toEqual(["/p02", "/p03", "/p01", "readme"])
    drag(tab("/p01"), "dragstart")
    drag(list, "dragover", 0)
    drag(tab("/p01"), "dragend")
    drag(list, "drop", 0)
    expect(order()).toEqual(["/p02", "/p03", "/p01", "readme"])
    expect(container.querySelector(".dragging, .drop-before, .drop-after")).toBeNull()
    const close = tab("/p01").querySelector("button")!
    act(() => close.dispatchEvent(new MouseEvent("pointerdown", { bubbles: true })))
    expect(drag(close, "dragstart").defaultPrevented).toBe(true)
    drag(list, "drop", 0)
    expect(order()).toEqual(["/p02", "/p03", "/p01", "readme"])
    expect(mockRouter.push).not.toHaveBeenCalled()
  })

  it("moves the current README without dragging or navigating and retains control focus", () => {
    render()
    navigate("/p01", "p01.md")
    navigate("/", "README.md", "/", "readme")
    const right = container.querySelector<HTMLButtonElement>('button[aria-label="현재 탭 오른쪽으로 이동"]')!
    const left = container.querySelector<HTMLButtonElement>('button[aria-label="현재 탭 왼쪽으로 이동"]')!
    act(() => left.click())
    right.focus()
    act(() => right.click())
    act(() => right.click())
    expect(Array.from(container.querySelectorAll<HTMLElement>(".tab-list [data-tab-id]"), (tab) => tab.dataset.tabId)).toEqual(["/p01", "readme"])
    expect(container.querySelector(".tab.active")?.getAttribute("data-tab-id")).toBe("readme")
    expect(container.querySelector('[role="status"]')?.textContent).toBe("README.md 탭, 2개 중 2번째 위치")
    expect(document.activeElement).toBe(right)
    act(() => left.click())
    expect(Array.from(container.querySelectorAll<HTMLElement>(".tab-list [data-tab-id]"), (tab) => tab.dataset.tabId)).toEqual(["readme", "/p01"])
    expect(mockRouter.push).not.toHaveBeenCalled()
  })

  it.each([{ metaKey: true }, { ctrlKey: true }])("keeps selection in this window on a modified tab click %j", (modifier) => {
    render()
    navigate("/p01", "p01.md")
    navigate("/p02", "p02.md")
    const link = container.querySelector<HTMLAnchorElement>('.tab-list [data-tab-id="/p01"] a')!
    document.addEventListener("click", (event) => event.preventDefault(), { once: true })
    act(() => link.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true, ...modifier })))
    expect(container.querySelector(".tab.active")?.getAttribute("data-tab-id")).toBe("/p02")
    expect(mockRouter.push).not.toHaveBeenCalled()
    closeTab("p02.md")
    expect(mockRouter.push.mock.calls).toEqual([["/p01"]])
  })

  it("marks search and graph by route whether the explorer is open or closed", () => {
    navigate("/search", "search", "/search", "page")
    const explorer = container.querySelector('button[aria-label="explorer"]') as HTMLButtonElement
    const search = () => container.querySelector('a[aria-label="search"]')
    const graph = () => container.querySelector('a[aria-label="graph"]')

    expect(explorer.getAttribute("aria-pressed")).toBe("true")
    expect(search()?.getAttribute("aria-current")).toBe("page")
    expect(explorer.classList.contains("active")).toBe(false)
    expect(graph()?.hasAttribute("aria-current")).toBe(false)

    act(() => explorer.click())
    expect(explorer.getAttribute("aria-pressed")).toBe("false")
    expect(search()?.getAttribute("aria-current")).toBe("page")

    navigate("/graph", "graph.md", "/graph", "graph")
    expect(search()?.hasAttribute("aria-current")).toBe(false)
    expect(graph()?.getAttribute("aria-current")).toBe("page")

    act(() => explorer.click())
    expect(explorer.getAttribute("aria-pressed")).toBe("true")
    expect(graph()?.getAttribute("aria-current")).toBe("page")
    expect(explorer.classList.contains("active")).toBe(false)

    navigate("/p02", "p02.md")
    expect(explorer.classList.contains("active")).toBe(true)
    expect(graph()?.hasAttribute("aria-current")).toBe(false)
  })

  it("keeps an open older post listed across tab switches until its tab closes", () => {
    render()
    expect(postEntries()).toEqual(recentEntries)

    navigate("/p16#section", "p16.md")
    expect(postEntries()).toEqual([...recentEntries, "◧p16.md"])
    expect(currentPostEntries()).toEqual(["◧p16.md"])

    // Opening a recent post neither duplicates it nor drops the older one.
    navigate("/p02", "p02.md")
    expect(postEntries()).toEqual([...recentEntries, "◧p16.md"])
    expect(currentPostEntries()).toEqual(["◧p02.md"])

    // Non-post documents with .md tabs never enter the posts list.
    navigate("/graph", "graph.md", "/graph", "graph")
    expect(postEntries()).toEqual([...recentEntries, "◧p16.md"])
    expect(currentPostEntries()).toEqual([])

    navigate("/p17", "p17.md")
    expect(postEntries()).toEqual([...recentEntries, "◧p16.md", "◧p17.md"])

    closeTab("p16.md")
    expect(postEntries()).toEqual([...recentEntries, "◧p17.md"])
    expect(currentPostEntries()).toEqual(["◧p17.md"])
  })

  it("lists a detail-only post on direct entry but not page documents", () => {
    const hidden = makePost("hidden-note", { status: ["PublicOnDetail"] })
    client.setQueryData(queryKey.post(hidden.slug), detail(hidden))
    client.setQueryData(
      queryKey.post("about"),
      detail(makePost("about", { type: ["Page"] }))
    )
    client.setQueryData(
      queryKey.post("now"),
      detail(makePost("now", { type: ["Page"] }))
    )

    navigate("/hidden-note?ref=feed", "hidden-note.md")
    expect(postEntries()).toEqual([...recentEntries, "◧hidden-note.md"])
    expect(currentPostEntries()).toEqual(["◧hidden-note.md"])

    navigate("/about", "about.md", "/[slug]", "about")
    navigate("/now", "now.md", "/[slug]", "page")
    expect(postEntries()).toEqual([...recentEntries, "◧hidden-note.md"])
    expect(currentPostEntries()).toEqual([])

    closeTab("hidden-note.md")
    expect(postEntries()).toEqual(recentEntries)
  })
})
