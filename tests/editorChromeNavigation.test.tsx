import React, { act } from "react"
import { createRoot, type Root } from "react-dom/client"
import { ThemeProvider } from "@emotion/react"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import ActivityBar from "src/layouts/RootLayout/EditorChrome/ActivityBar"
import FileTree from "src/layouts/RootLayout/EditorChrome/FileTree"
import TabBar from "src/layouts/RootLayout/EditorChrome/TabBar"
import {
  RouteChromeProvider,
  useRegisterChrome,
} from "src/layouts/RootLayout/EditorChrome/RouteChromeContext"
import { queryKey } from "src/constants/queryKey"
import { createTheme } from "src/styles/theme"
import type { PostDetail, TPost } from "src/types"

const mockRouter = {
  pathname: "/",
  asPath: "/",
  query: {} as Record<string, string>,
  push: jest.fn(),
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
const Document = ({ filename }: { filename: string }) => {
  useRegisterChrome(filename, statusItems)
  return null
}

describe("editor chrome navigation", () => {
  let container: HTMLDivElement
  let root: Root
  let client: QueryClient
  let filename = "README.md"

  const render = () =>
    act(() =>
      root.render(
        <QueryClientProvider client={client}>
          <ThemeProvider theme={createTheme({ scheme: "dark" })}>
            <RouteChromeProvider>
              <ActivityBar />
              <FileTree />
              <TabBar />
              <Document key={mockRouter.asPath} filename={filename} />
            </RouteChromeProvider>
          </ThemeProvider>
        </QueryClientProvider>
      )
    )

  const navigate = (asPath: string, nextFilename: string, pathname = "/[slug]") => {
    mockRouter.asPath = asPath
    mockRouter.pathname = pathname
    const slug = asPath.split(/[?#]/)[0].slice(1)
    mockRouter.query = pathname === "/[slug]" ? { slug: decodeURIComponent(slug) } : {}
    filename = nextFilename
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
  })

  afterEach(() => {
    act(() => root.unmount())
    container.remove()
    client.clear()
    jest.clearAllMocks()
  })

  it("marks search and graph by route whether the explorer is open or closed", () => {
    navigate("/search", "search", "/search")
    const explorer = container.querySelector('button[aria-label="explorer"]') as HTMLButtonElement
    const search = () => container.querySelector('a[aria-label="search"]')
    const graph = () => container.querySelector('a[aria-label="graph"]')

    expect(explorer.getAttribute("aria-pressed")).toBe("true")
    expect(search()?.getAttribute("aria-current")).toBe("page")
    expect(graph()?.hasAttribute("aria-current")).toBe(false)

    act(() => explorer.click())
    expect(explorer.getAttribute("aria-pressed")).toBe("false")
    expect(search()?.getAttribute("aria-current")).toBe("page")

    navigate("/graph", "graph.md", "/graph")
    expect(search()?.hasAttribute("aria-current")).toBe(false)
    expect(graph()?.getAttribute("aria-current")).toBe("page")

    act(() => explorer.click())
    expect(explorer.getAttribute("aria-pressed")).toBe("true")
    expect(graph()?.getAttribute("aria-current")).toBe("page")
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
    navigate("/graph", "graph.md", "/graph")
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

    navigate("/about", "about.md")
    navigate("/now", "now.md")
    expect(postEntries()).toEqual([...recentEntries, "◧hidden-note.md"])
    expect(currentPostEntries()).toEqual([])

    closeTab("hidden-note.md")
    expect(postEntries()).toEqual(recentEntries)
  })
})
