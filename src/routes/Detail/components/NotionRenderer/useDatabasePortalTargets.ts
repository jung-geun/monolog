import { useEffect, useRef, useState } from "react"
import { ExtendedRecordMap } from "notion-types"
import { unwrapBlock } from "src/libs/utils/notion/unwrapBlock"

export function useDatabasePortalTargets(
  recordMap: ExtendedRecordMap | null
): Map<string, HTMLElement> {
  const [targets, setTargets] = useState<Map<string, HTMLElement>>(new Map())
  const portalNodesRef = useRef<HTMLElement[]>([])

  useEffect(() => {
    // Purge previous portal targets unconditionally before doing anything.
    for (const node of portalNodesRef.current) {
      node.parentNode?.removeChild(node)
    }
    portalNodesRef.current = []
    if (!recordMap) {
      setTargets(new Map())
      return
    }

    let cancelled = false
    const timer = setTimeout(() => {
      if (cancelled) return

      const nextTargets = new Map<string, HTMLElement>()
      const nextNodes: HTMLElement[] = []

      Object.entries(recordMap.block).forEach(([blockId, blockData]) => {
        const block = unwrapBlock(blockData)
        if (block?.type !== "collection_view_page") return

        const dashed = `notion-block-${blockId}`
        const undashed = `notion-block-${blockId.replace(/-/g, "")}`
        const targetBlock =
          document.querySelector(`.${dashed}`) ||
          document.querySelector(`.${undashed}`)
        if (!targetBlock?.parentNode) return

        const portalTarget = document.createElement("div")
        portalTarget.className = "database-portal-target"
        portalTarget.setAttribute("data-database-id", blockId)
        targetBlock.parentNode.insertBefore(portalTarget, targetBlock.nextSibling)

        nextTargets.set(blockId, portalTarget)
        nextNodes.push(portalTarget)
      })

      portalNodesRef.current = nextNodes
      setTargets(nextTargets)
    }, 200)

    return () => {
      cancelled = true
      clearTimeout(timer)
      for (const node of portalNodesRef.current) {
        node.parentNode?.removeChild(node)
      }
      portalNodesRef.current = []
    }
  }, [recordMap])

  return targets
}
