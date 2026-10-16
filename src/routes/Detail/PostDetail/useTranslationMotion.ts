import { useEffect, useLayoutEffect, useRef, type RefObject } from "react"

// Animate presentation only. React keeps ownership of every text node, source row
// and block ID, so translation never breaks selection, links or hydration.
const textTargets = ".post-title, .post-summary, .notion-text, .notion-h-title, .notion-quote, .notion-list li, .notion-callout-text, .notion-bookmark-title, .notion-bookmark-description, .notion-caption, .notion-table td, .notion-table th, .source-text, .toc-item"

export default function useTranslationMotion(root: RefObject<HTMLDivElement | null>, active: boolean, slug: string | undefined) {
  const enabled = useRef(active)
  useLayoutEffect(() => { enabled.current = active }, [active])
  useEffect(() => {
    const container = root.current
    if (!container) return
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)")
    const pending = new Set<HTMLElement>()
    const animations = new Map<HTMLElement, Animation>()
    let frame = 0
    const cancel = () => {
      cancelAnimationFrame(frame)
      frame = 0
      pending.clear()
      for (const animation of animations.values()) animation.cancel()
      animations.clear()
    }
    const observer = new MutationObserver(records => {
      if (!enabled.current || reduced.matches) return
      for (const record of records) {
        if (record.type === "characterData" && record.oldValue === record.target.nodeValue) continue
        if (record.type === "childList" && Array.from(record.removedNodes, node => node.textContent || "").join("") === Array.from(record.addedNodes, node => node.textContent || "").join("")) continue
        const parent = record.target instanceof Element ? record.target : record.target.parentElement
        const target = parent?.closest<HTMLElement>(textTargets)
        if (target && container.contains(target)) pending.add(target)
      }
      if (!pending.size || frame) return
      frame = requestAnimationFrame(() => {
        frame = 0
        if (!enabled.current || reduced.matches || window.getSelection()?.isCollapsed === false) { pending.clear(); return }
        let count = 0
        for (const target of pending) {
          if (!target.isConnected || !target.getClientRects().length || typeof target.animate !== "function") continue
          const bounds = target.getBoundingClientRect()
          const pane = target.closest(".document-preview, .document-source, .document-rail")?.getBoundingClientRect() || container.getBoundingClientRect()
          if (bounds.bottom <= Math.max(0, pane.top) || bounds.top >= Math.min(innerHeight, pane.bottom) || bounds.right <= pane.left || bounds.left >= pane.right) continue
          animations.get(target)?.cancel()
          const animation = target.animate([
            { opacity: 0, filter: "blur(5px)", transform: "translateY(3px)", textShadow: "-3px 0 currentColor, 3px 0 currentColor" },
            { opacity: .55, filter: "blur(1.5px)", transform: "translateY(-1px)", textShadow: "-1px 0 currentColor, 1px 0 currentColor", offset: .55 },
            { opacity: 1, filter: "blur(0px)", transform: "none", textShadow: "0 0 transparent" },
          ], { duration: 380, easing: "cubic-bezier(.22,1,.36,1)" })
          animations.set(target, animation)
          animation.onfinish = () => { if (animations.get(target) === animation) animations.delete(target) }
          if (++count === 24) break
        }
        pending.clear()
      })
    })
    observer.observe(container, { subtree: true, childList: true, characterData: true, characterDataOldValue: true })
    reduced.addEventListener("change", cancel)
    return () => { observer.disconnect(); reduced.removeEventListener("change", cancel); cancel() }
  }, [root, slug])
}
