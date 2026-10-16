import { act } from "react"
import { createRoot, type Root } from "react-dom/client"
import useArticleAnalytics from "src/hooks/useArticleAnalytics"

;(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true

function Harness() {
  useArticleAnalytics({ slug: "long-article" })
  return null
}

let root: Root
let host: HTMLDivElement
let preview: HTMLDivElement
let source: HTMLDivElement
let gtag: jest.Mock
let previousGtag: PropertyDescriptor | undefined
const rectangle = { top: 100, bottom: 600, left: 0, right: 500, width: 500, height: 500, x: 0, y: 100, toJSON: () => ({}) }

beforeEach(() => {
  jest.useFakeTimers()
  jest.spyOn(document, "visibilityState", "get").mockReturnValue("visible")
  jest.spyOn(document.documentElement, "scrollHeight", "get").mockReturnValue(window.innerHeight)
  previousGtag = Object.getOwnPropertyDescriptor(window, "gtag")
  gtag = jest.fn()
  Object.defineProperty(window, "gtag", { configurable: true, value: gtag })
  document.body.innerHTML = '<div class="page-content" style="overflow-y:hidden"><div class="document-preview" style="overflow-y:auto"></div><div class="document-source" style="overflow-y:auto;display:none"></div></div>'
  preview = document.querySelector(".document-preview")!
  source = document.querySelector(".document-source")!
  source.innerHTML = '<span class="source-line">Source text</span>'
  for (const pane of [preview, source]) {
    Object.defineProperties(pane, { scrollHeight: { configurable: true, value: 2000 }, clientHeight: { configurable: true, value: 500 } })
    jest.spyOn(pane, "getClientRects").mockImplementation(() => (pane.style.display === "none" ? [] : [rectangle]) as unknown as DOMRectList)
  }
  host = document.createElement("div")
  document.body.appendChild(host)
  root = createRoot(host)
  act(() => root.render(<Harness />))
})

afterEach(() => {
  if (root) act(() => root.unmount())
  document.body.innerHTML = ""
  if (previousGtag) Object.defineProperty(window, "gtag", previousGtag)
  else Reflect.deleteProperty(window, "gtag")
  jest.restoreAllMocks()
  jest.useRealTimers()
})

it("does not count an unscrolled long article as read inside a non-scrolling window", () => {
  act(() => jest.advanceTimersByTime(35_000))
  expect(gtag.mock.calls.filter(call => ["article_progress", "article_read"].includes(call[1]))).toEqual([])
  preview.scrollTop = 1125
  act(() => { preview.dispatchEvent(new Event("scroll")); jest.advanceTimersByTime(32) })
  expect(gtag.mock.calls.filter(call => call[1] === "article_progress").map(call => call[2].percent)).toEqual([25, 50, 75])
  expect(gtag).toHaveBeenCalledWith("event", "article_read", { article_slug: "long-article", engagement_time_msec: 35_000, max_scroll_percent: 75 })
})

it("follows a visible Source pane without tracking its hidden preview", async () => {
  preview.scrollTop = 1500
  preview.style.display = "none"
  source.style.display = "block"
  source.scrollTop = 750
  await act(async () => { await Promise.resolve() })
  act(() => jest.advanceTimersByTime(32))
  expect(gtag.mock.calls.filter(call => call[1] === "article_progress").map(call => call[2].percent)).toEqual([25, 50])
  expect(gtag.mock.calls.filter(call => call[1] === "article_read")).toEqual([])
})

it("does not invent completion when the article panes disappear during navigation", () => {
  act(() => jest.advanceTimersByTime(35_000))
  document.querySelector(".page-content")!.remove()
  act(() => root.unmount())
  root = null as unknown as Root
  expect(gtag.mock.calls.filter(call => ["article_progress", "article_read"].includes(call[1]))).toEqual([])
  expect(gtag).toHaveBeenCalledWith("event", "article_engagement", { article_slug: "long-article", engagement_time_msec: 35_000, max_scroll_percent: 0 })
})

it("does not mark an unloaded Source placeholder as a completed short article", async () => {
  preview.style.display = "none"
  source.style.display = "block"
  source.innerHTML = '<p role="status">Loading Markdown source…</p>'
  Object.defineProperty(source, "scrollHeight", { configurable: true, value: 500 })
  act(() => jest.advanceTimersByTime(35_000))
  expect(gtag.mock.calls.filter(call => ["article_progress", "article_read"].includes(call[1]))).toEqual([])
  Object.defineProperty(source, "scrollHeight", { configurable: true, value: 2000 })
  source.innerHTML = '<span class="source-line">Loaded Source text</span>'
  await act(async () => { await Promise.resolve() })
  act(() => jest.advanceTimersByTime(32))
  expect(gtag.mock.calls.filter(call => ["article_progress", "article_read"].includes(call[1]))).toEqual([])
  source.scrollTop = 1125
  act(() => { source.dispatchEvent(new Event("scroll")); jest.advanceTimersByTime(32) })
  expect(gtag).toHaveBeenCalledWith("event", "article_read", { article_slug: "long-article", engagement_time_msec: 35_000, max_scroll_percent: 75 })
})
