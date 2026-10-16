export function getReadingScrollRoot(): HTMLElement | Window {
  // Preview wins when both split panes are visible; source owns source-only and
  // compact split/source layouts. Hidden panes still have overflow:auto.
  for (const pane of document.querySelectorAll<HTMLElement>(".document-preview, .document-source")) {
    if (pane.getClientRects().length && getComputedStyle(pane).visibility !== "hidden" && /auto|scroll/.test(getComputedStyle(pane).overflowY)) return pane
  }
  const editor = document.querySelector<HTMLElement>(".page-content")
  return editor && /auto|scroll/.test(getComputedStyle(editor).overflowY) ? editor : window
}

export function readingScrollOffset(root: HTMLElement | Window): number {
  return root instanceof HTMLElement ? root.getBoundingClientRect().top : 0
}

/** Follow pane switches, container resizing and asynchronously rendered content. */
export function observeReadingScroll(update: () => void): () => void {
  let frame = 0
  const schedule = () => {
    if (frame) return
    frame = requestAnimationFrame(() => { frame = 0; update() })
  }
  const observed = new Set<Element>()
  const resize = new ResizeObserver(schedule)
  const refresh = () => {
    for (const element of observed) {
      if (!element.isConnected) { resize.unobserve(element); observed.delete(element) }
    }
    for (const element of document.querySelectorAll(".page-content, .document-panes, .document-preview, .document-source, .document-preview > *, .document-source > *")) {
      if (!observed.has(element)) { observed.add(element); resize.observe(element) }
    }
    schedule()
  }
  const mutations = new MutationObserver(refresh)
  const editor = document.querySelector(".page-content")
  if (editor) mutations.observe(editor, { subtree: true, childList: true, attributes: true, attributeFilter: ["class", "hidden"] })
  // Scroll does not bubble, but capture also sees newly mounted source panes.
  window.addEventListener("scroll", schedule, { capture: true, passive: true })
  window.addEventListener("resize", schedule)
  refresh()
  return () => {
    cancelAnimationFrame(frame)
    mutations.disconnect()
    resize.disconnect()
    window.removeEventListener("scroll", schedule, true)
    window.removeEventListener("resize", schedule)
  }
}
