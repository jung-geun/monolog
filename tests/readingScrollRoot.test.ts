import { getReadingScrollRoot, observeReadingScroll, readingScrollOffset } from "src/routes/Detail/PostDetail/scrollRoot"

const rect = { top: 100, bottom: 500, left: 0, right: 500, width: 500, height: 400, x: 0, y: 100, toJSON: () => ({}) }

const show = (element: HTMLElement, visible = true) => {
  jest.spyOn(element, "getClientRects").mockReturnValue((visible ? [rect] : []) as unknown as DOMRectList)
  jest.spyOn(element, "getBoundingClientRect").mockReturnValue(rect)
}

let editor: HTMLElement
let preview: HTMLElement
let source: HTMLElement

beforeEach(() => {
  jest.useFakeTimers()
  document.body.innerHTML = `<div class="page-content" style="overflow-y:auto"><div class="post-detail"><div class="document-panes document-panes--split mobile-pane--preview"><div class="document-preview" style="overflow-y:auto"><article class="body"></article></div><div class="document-source" style="overflow-y:auto"><section></section></div></div></div></div>`
  editor = document.querySelector<HTMLElement>(".page-content")!
  preview = document.querySelector<HTMLElement>(".document-preview")!
  source = document.querySelector<HTMLElement>(".document-source")!
  show(preview)
  show(source)
})

afterEach(() => {
  document.body.innerHTML = ""
  jest.restoreAllMocks()
  jest.useRealTimers()
})

it("uses preview in preview and wide split, and its real viewport offset", () => {
  expect(getReadingScrollRoot()).toBe(preview)
  expect(readingScrollOffset(preview)).toBe(100)
  source.remove()
  expect(getReadingScrollRoot()).toBe(preview)
})

it("uses source rather than the hidden preview in source-only and compact split/source", () => {
  show(preview, false)
  preview.hidden = true
  expect(getReadingScrollRoot()).toBe(source)
  preview.hidden = false
  document.querySelector(".document-panes")!.className = "document-panes document-panes--split mobile-pane--source"
  expect(getReadingScrollRoot()).toBe(source)
})

it("ignores visibility:hidden panes and preserves generic-route and window roots", () => {
  preview.style.visibility = "hidden"
  expect(getReadingScrollRoot()).toBe(source)
  source.remove()
  expect(getReadingScrollRoot()).toBe(editor)
  editor.style.overflowY = "visible"
  expect(getReadingScrollRoot()).toBe(window)
  expect(readingScrollOffset(window)).toBe(0)
})

it("follows pane switches, newly mounted source and non-bubbling pane scrolls", async () => {
  const roots: (HTMLElement | Window)[] = []
  const stop = observeReadingScroll(() => roots.push(getReadingScrollRoot()))
  jest.runOnlyPendingTimers()
  expect(roots.pop()).toBe(preview)

  show(preview, false)
  document.querySelector(".document-panes")!.classList.replace("mobile-pane--preview", "mobile-pane--source")
  await Promise.resolve()
  jest.runOnlyPendingTimers()
  expect(roots.pop()).toBe(source)

  source.remove()
  const replacement = document.createElement("div")
  replacement.className = "document-source"
  replacement.style.overflowY = "auto"
  show(replacement)
  document.querySelector(".document-panes")!.appendChild(replacement)
  await Promise.resolve()
  jest.runOnlyPendingTimers()
  expect(roots.pop()).toBe(replacement)

  replacement.dispatchEvent(new Event("scroll"))
  jest.runOnlyPendingTimers()
  expect(roots.pop()).toBe(replacement)
  roots.length = 0
  stop()
  replacement.dispatchEvent(new Event("scroll"))
  window.dispatchEvent(new Event("resize"))
  jest.runOnlyPendingTimers()
  expect(roots).toEqual([])
})

it("re-resolves the pane on a container resize without a window resize", () => {
  let onResize: ResizeObserverCallback = () => {}
  jest.spyOn(globalThis, "ResizeObserver").mockImplementation(callback => {
    onResize = callback
    return { observe: jest.fn(), unobserve: jest.fn(), disconnect: jest.fn() }
  })
  const update = jest.fn(() => getReadingScrollRoot())
  const stop = observeReadingScroll(update)
  jest.runOnlyPendingTimers()
  expect(update).toHaveLastReturnedWith(preview)
  show(preview, false)
  onResize([], {} as ResizeObserver)
  jest.runOnlyPendingTimers()
  expect(update).toHaveLastReturnedWith(source)
  stop()
})
