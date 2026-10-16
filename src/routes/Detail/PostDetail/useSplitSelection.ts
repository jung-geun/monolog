import { useEffect, useRef, type RefObject } from "react"

const selectedClass = "split-selection-match"
const highlightName = "split-selection"

function previewBlockId(element: Element): string | undefined {
  if (element.matches(".post-title")) return "title"
  if (element.matches(".post-summary")) return "summary"
  return Array.from(element.classList).find(name => /^notion-block-[\da-f-]+$/i.test(name))?.slice(13).replace(/-/g, "").toLowerCase()
}

function selectedText(range: Range, element: Element): string {
  const clipped = document.createRange()
  clipped.selectNodeContents(element)
  if (!range.intersectsNode(element)) return ""
  if (range.compareBoundaryPoints(Range.START_TO_START, clipped) > 0) clipped.setStart(range.startContainer, range.startOffset)
  if (range.compareBoundaryPoints(Range.END_TO_END, clipped) < 0) clipped.setEnd(range.endContainer, range.endOffset)
  return clipped.toString()
}

function matchingTextRange(elements: HTMLElement[], text: string): Range | undefined {
  if (!text) return
  const nodes: { node: Text; start: number }[] = []
  let content = ""
  for (const element of elements) {
    if (content && element.matches(".source-text")) content += "\n"
    const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT, {
      acceptNode: node => node.parentElement?.closest("button, .source-number, .katex-mathml") ? NodeFilter.FILTER_REJECT : NodeFilter.FILTER_ACCEPT,
    })
    while (walker.nextNode()) {
      const node = walker.currentNode as Text
      nodes.push({ node, start: content.length })
      content += node.data
    }
  }
  const start = content.indexOf(text)
  // Repeated text inside a block is ambiguous: keep the block highlight instead.
  if (start < 0 || content.indexOf(text, start + 1) >= 0) return
  const range = document.createRange()
  let started = false
  for (const { node, start: offset } of nodes) {
    const end = offset + node.length
    if (!started && start >= offset && start < end) {
      range.setStart(node, start - offset)
      started = true
    }
    if (started && start + text.length >= offset && start + text.length <= end) {
      range.setEnd(node, start + text.length - offset)
      return range
    }
  }
}

/** Mirror native drag selections without replacing either pane's React-owned DOM. */
export default function useSplitSelection(panes: RefObject<HTMLDivElement | null>, enabled: boolean, slug: string | undefined) {
  const synchronizing = useRef(false)
  useEffect(() => {
    if (!enabled) return
    const container = panes.current
    const preview = container?.querySelector<HTMLElement>(".document-preview")
    const source = container?.querySelector<HTMLElement>(".document-source")
    if (!container || !preview || !source) return
    let origin: HTMLElement | null = null
    let frame = 0
    let releaseFrame = 0
    let highlighted: HTMLElement[] = []
    let previousMatch = ""
    const clear = () => {
      for (const element of highlighted) element.classList.remove(selectedClass)
      highlighted = []
      if (typeof CSS !== "undefined" && "highlights" in CSS) CSS.highlights.delete(highlightName)
      previousMatch = ""
    }
    const update = () => {
      frame = 0
      const selection = document.getSelection()
      if (!origin || !selection || selection.isCollapsed || !selection.rangeCount) { clear(); return }
      const range = selection.getRangeAt(0)
      if (!origin.contains(range.startContainer) || !origin.contains(range.endContainer)) { clear(); return }
      const fromSource = origin === source
      const rows = Array.from(source.querySelectorAll<HTMLElement>("[data-source-block]"))
      const ids = new Set<string>()
      let text = ""
      if (fromSource) {
        const pieces: string[] = []
        for (const row of rows) {
          const content = row.querySelector(".source-text")
          if (!content) continue
          const part = selectedText(range, content)
          if (!part) continue
          if (row.dataset.sourceBlock) ids.add(row.dataset.sourceBlock)
          pieces.push(part)
        }
        text = pieces.join("\n").trim()
      } else {
        const mapped = new Set(rows.map(row => row.dataset.sourceBlock))
        const walker = document.createTreeWalker(preview, NodeFilter.SHOW_TEXT)
        while (walker.nextNode()) {
          const node = walker.currentNode
          if (!node.textContent?.trim() || !range.intersectsNode(node) || !selectedText(range, node.parentElement!)) continue
          let element = node.parentElement
          if (element?.closest("button, .katex-mathml")) continue
          while (element && element !== preview) {
            const id = previewBlockId(element)
            if (id && mapped.has(id)) { ids.add(id); break }
            element = element.parentElement
          }
        }
        text = range.toString().trim()
      }
      const targets = fromSource
        ? Array.from(preview.querySelectorAll<HTMLElement>("[class*='notion-block-'], .post-title, .post-summary")).filter(element => ids.has(previewBlockId(element) || ""))
        : rows.filter(row => ids.has(row.dataset.sourceBlock || ""))
      if (!targets.length) { clear(); return }
      for (const element of highlighted) element.classList.remove(selectedClass)
      highlighted = targets
      for (const element of highlighted) element.classList.add(selectedClass)
      for (const element of targets) {
        let details = element.closest("details")
        while (details && preview.contains(details)) {
          details.open = true
          details = details.parentElement?.closest("details") ?? null
        }
      }
      const textTargets = fromSource ? targets.map(element => element.querySelector<HTMLElement>("pre code") || element) : targets.map(element => element.querySelector<HTMLElement>(".source-text") || element)
      const exact = matchingTextRange(textTargets, text)
      if (typeof CSS !== "undefined" && "highlights" in CSS && typeof Highlight !== "undefined") {
        CSS.highlights.delete(highlightName)
        if (exact) {
          const ranges = textTargets.filter(element => exact.intersectsNode(element)).map(element => {
            const clipped = document.createRange()
            clipped.selectNodeContents(element)
            if (exact.compareBoundaryPoints(Range.START_TO_START, clipped) > 0) clipped.setStart(exact.startContainer, exact.startOffset)
            if (exact.compareBoundaryPoints(Range.END_TO_END, clipped) < 0) clipped.setEnd(exact.endContainer, exact.endOffset)
            return clipped
          })
          CSS.highlights.set(highlightName, new Highlight(...ranges))
        }
      }
      const key = [...ids].join(" ") + ":" + text
      const target = fromSource ? preview : source
      const backwards = selection.anchorNode === range.endContainer && selection.anchorOffset === range.endOffset
      const focusRange = exact?.cloneRange()
      focusRange?.collapse(backwards)
      const focusTarget = backwards ? targets[0] : targets[targets.length - 1]
      if (key !== previousMatch && target.getBoundingClientRect().height > 0) {
        // Code blocks scroll independently inside either pane. Reveal the text
        // there first, then position the containing pane using its new bounds.
        const focusNode = backwards ? exact?.startContainer : exact?.endContainer
        const focusElement = focusNode?.nodeType === Node.ELEMENT_NODE ? focusNode as Element : focusNode?.parentElement
        const codeScroller = fromSource ? focusElement?.closest("pre") : source
        if (codeScroller && focusRange) {
          const bounds = codeScroller.getBoundingClientRect()
          const position = focusRange.getBoundingClientRect()
          if (position.left < bounds.left + 54 || position.right > bounds.right) codeScroller.scrollLeft += position.left - bounds.left - 70
          if (codeScroller.scrollHeight > codeScroller.clientHeight && (position.top < bounds.top || position.bottom > bounds.bottom)) codeScroller.scrollTop += position.top - bounds.top - 24
        }
        const bounds = target.getBoundingClientRect()
        const destination = focusRange?.getBoundingClientRect() ?? focusTarget.getBoundingClientRect()
        if (destination.top < bounds.top + 45 || destination.bottom > bounds.bottom - 20) {
          target.scrollTop += destination.top - bounds.top - 60
        }
      }
      previousMatch = key
    }
    const schedule = () => { if (!frame) frame = requestAnimationFrame(update) }
    const down = (event: PointerEvent) => {
      if (event.button !== 0 || !(event.target instanceof Element) || event.target.closest("button, input")) return
      const pane = event.target.closest<HTMLElement>(".document-preview, .document-source")
      if (pane !== preview && pane !== source) return
      cancelAnimationFrame(releaseFrame)
      origin = pane
      synchronizing.current = true
      clear()
    }
    const changed = () => {
      if (origin) schedule()
      else if (document.getSelection()?.isCollapsed || !container.contains(document.getSelection()?.anchorNode ?? null)) clear()
    }
    const up = () => {
      if (!origin) return
      cancelAnimationFrame(frame)
      update()
      origin = null
      releaseFrame = requestAnimationFrame(() => { releaseFrame = requestAnimationFrame(() => { synchronizing.current = false }) })
    }
    container.addEventListener("pointerdown", down)
    document.addEventListener("selectionchange", changed)
    document.addEventListener("pointerup", up)
    document.addEventListener("pointercancel", up)
    window.addEventListener("blur", up)
    return () => {
      cancelAnimationFrame(frame)
      cancelAnimationFrame(releaseFrame)
      clear()
      synchronizing.current = false
      container.removeEventListener("pointerdown", down)
      document.removeEventListener("selectionchange", changed)
      document.removeEventListener("pointerup", up)
      document.removeEventListener("pointercancel", up)
      window.removeEventListener("blur", up)
    }
  }, [panes, enabled, slug])
  return synchronizing
}
