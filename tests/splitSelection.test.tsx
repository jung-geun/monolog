import { act, useRef } from "react"
import { createRoot, type Root } from "react-dom/client"
import useSplitSelection from "src/routes/Detail/PostDetail/useSplitSelection"

;(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true

const first = "a".repeat(32)
const second = "b".repeat(32)
const code = "c".repeat(32)
const box = (top: number, bottom: number) => ({ top, bottom, left: 0, right: 600, width: 600, height: bottom - top, x: 0, y: top, toJSON: () => ({}) })

function Document({ enabled = true, slug = "post" }: { enabled?: boolean; slug?: string }) {
  const panes = useRef<HTMLDivElement>(null)
  useSplitSelection(panes, enabled, slug)
  return <div ref={panes}>
    <div className="document-preview"><p className={`notion-block-${first}`}>Repeated paragraph</p><p className={`notion-block-${second}`}>Repeated paragraph</p><figure className={`notion-block-${code}`}><pre><code><span>const </span><span>answer = 42</span></code></pre></figure></div>
    <div className="document-source"><pre>{[[first, "Repeated paragraph"], [second, "Repeated paragraph"], [code, "```js"], [code, "const answer = 42"], [code, "```"]].map(([id, text], i) => <span key={i} data-source-block={id} data-source-line={i + 1}><span className="source-number">{i + 1}</span><span className="source-text">{text}</span></span>)}</pre></div>
  </div>
}

let host: HTMLDivElement
let root: Root
const originalMatchMedia = window.matchMedia
const rangeRect = Object.getOwnPropertyDescriptor(Range.prototype, "getBoundingClientRect")

beforeEach(() => {
  jest.useFakeTimers()
  window.matchMedia = jest.fn().mockReturnValue({ matches: true })
  Object.defineProperty(Range.prototype, "getBoundingClientRect", { configurable: true, value: () => box(900, 930) })
  host = document.createElement("div")
  document.body.appendChild(host)
  root = createRoot(host)
  act(() => root.render(<Document />))
  for (const pane of host.querySelectorAll<HTMLElement>(".document-preview, .document-source")) pane.getBoundingClientRect = () => box(100, 500)
  for (const element of host.querySelectorAll<HTMLElement>("[data-source-block], [class*='notion-block-']")) element.getBoundingClientRect = () => box(900, 930)
})

afterEach(() => {
  act(() => root.unmount())
  host.remove()
  document.getSelection()?.removeAllRanges()
  window.matchMedia = originalMatchMedia
  if (rangeRect) Object.defineProperty(Range.prototype, "getBoundingClientRect", rangeRect)
  else Reflect.deleteProperty(Range.prototype, "getBoundingClientRect")
  jest.useRealTimers()
})

function drag(start: Node, startOffset: number, end: Node, endOffset: number) {
  const target = start.nodeType === Node.TEXT_NODE ? start.parentElement! : start as Element
  act(() => {
    target.dispatchEvent(new MouseEvent("pointerdown", { bubbles: true, button: 0 }))
    const range = document.createRange()
    range.setStart(start, startOffset)
    range.setEnd(end, endOffset)
    const selection = document.getSelection()!
    selection.removeAllRanges()
    selection.addRange(range)
    document.dispatchEvent(new Event("selectionchange"))
    document.dispatchEvent(new MouseEvent("pointerup", { bubbles: true, button: 0 }))
    jest.runAllTimers()
  })
}

it("maps duplicate source text to its own preview block and scrolls only the opposite pane", () => {
  const row = host.querySelector(`[data-source-block='${second}'] .source-text`)!.firstChild!
  drag(row, 0, row, row.textContent!.length)
  expect(host.querySelector(`.notion-block-${second}`)?.classList.contains("split-selection-match")).toBe(true)
  expect(host.querySelector(`.notion-block-${first}`)?.classList.contains("split-selection-match")).toBe(false)
  expect(host.querySelector<HTMLElement>(".document-preview")!.scrollTop).toBe(740)
  expect(host.querySelector<HTMLElement>(".document-source")!.scrollTop).toBe(0)
  expect(document.getSelection()?.toString()).toBe("Repeated paragraph")
})

it("maps a preview selection across syntax tokens to the matching source code block", () => {
  const tokens = host.querySelectorAll(`.notion-block-${code} code span`)
  drag(tokens[0].firstChild!, 0, tokens[1].firstChild!, 11)
  const matches = host.querySelectorAll(".document-source .split-selection-match")
  expect(Array.from(matches, row => row.getAttribute("data-source-block"))).toEqual([code, code, code])
  expect(host.querySelector<HTMLElement>(".document-source")!.scrollTop).toBe(740)
  expect(host.querySelector<HTMLElement>(".document-preview")!.scrollTop).toBe(0)
})

it("mirrors all selected blocks and removes highlights when the native selection collapses", () => {
  const a = host.querySelector(`.notion-block-${first}`)!.firstChild!
  const b = host.querySelector(`.notion-block-${second}`)!.firstChild!
  drag(a, 0, b, b.textContent!.length)
  expect(host.querySelectorAll(".document-source .split-selection-match")).toHaveLength(2)
  act(() => { document.getSelection()?.removeAllRanges(); document.dispatchEvent(new Event("selectionchange")) })
  expect(host.querySelectorAll(".split-selection-match")).toHaveLength(0)
})

it("clears old document highlights on route changes and stops mirroring outside Split", () => {
  const row = host.querySelector(`[data-source-block='${first}'] .source-text`)!.firstChild!
  drag(row, 0, row, 8)
  act(() => root.render(<Document slug="another-post" />))
  expect(host.querySelectorAll(".split-selection-match")).toHaveLength(0)
  act(() => root.render(<Document enabled={false} slug="another-post" />))
  drag(row, 0, row, 8)
  expect(host.querySelectorAll(".split-selection-match")).toHaveLength(0)
})
