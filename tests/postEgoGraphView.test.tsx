import { ThemeProvider } from "@emotion/react"
import { renderToStaticMarkup } from "react-dom/server"
import useNotionGraphQuery from "src/hooks/useNotionGraphQuery"
import { buildGraph } from "src/libs/utils/graph"
import PostEgoGraph from "src/routes/Detail/PostDetail/PostEgoGraph"
import { resolveColorTheme } from "src/styles/colors"
import { createTheme } from "src/styles/theme"
import type { TPost } from "src/types"
import type { NotionGraph } from "src/types/notionGraph"

jest.mock("src/hooks/useNotionGraphQuery", () => ({
  __esModule: true,
  default: jest.fn(),
}))

const source: NotionGraph = {
  version: "v1",
  generatedAt: "2026-10-18T00:00:00.000Z",
  nodes: [
    { kind: "post", id: "center", slug: "center", title: "Center", category: "notes", tags: [], readTime: 1 },
    { kind: "post", id: "neighbor", slug: "neighbor", title: "Neighbor", category: "guides", tags: [], readTime: 1 },
    { kind: "tag", id: "tag", title: "tag & topic" },
    { kind: "series", id: "series", title: "A series" },
  ],
  edges: [
    { source: "center", target: "neighbor", type: "link", weight: 1 },
    { source: "center", target: "tag", type: "has-tag", weight: 1 },
    { source: "series", target: "center", type: "in-series", weight: 1 },
  ],
}
const graph = { ...buildGraph(source), generatedAt: source.generatedAt }
const post = { id: "center", title: "Center" } as TPost

beforeEach(() => {
  jest.mocked(useNotionGraphQuery).mockReturnValue(graph)
})

it("preserves direct post, tag and series destinations", () => {
  const host = document.createElement("div")
  host.innerHTML = renderToStaticMarkup(
    <ThemeProvider theme={createTheme({ colorTheme: resolveColorTheme("light-modern") })}>
      <PostEgoGraph post={post} />
    </ThemeProvider>
  )

  expect(host.querySelector('[data-kind="post"] a')?.getAttribute("href")).toBe("/neighbor")
  expect(host.querySelector('[data-kind="tag"] a')?.getAttribute("href")).toBe("/?tag=tag%20%26%20topic")
  expect(host.querySelector('[data-kind="series"] a')?.getAttribute("href")).toBe("/series/A%20series")
})

it("omits the mini graph when the post has no direct neighbors", () => {
  jest.mocked(useNotionGraphQuery).mockReturnValue({ ...graph, edges: [] })

  expect(renderToStaticMarkup(<PostEgoGraph post={post} />)).toBe("")
})
