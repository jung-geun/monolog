import type { ExtendedRecordMap } from "notion-types"
import { unwrapBlock } from "src/libs/utils/notion/unwrapBlock"

/**
 * RNX exposes Code/Equation component overrides, not a generic block hook.
 * Only those complete root-page blocks can emit a React-owned ad sibling.
 * Never descend into callouts, quotes, lists, tables, toggles or columns.
 */
export function planManualAdBoundaries(recordMap: ExtendedRecordMap | null): ReadonlySet<string> {
  const boundaries = new Set<string>()
  if (!recordMap) return boundaries
  const root = unwrapBlock(recordMap.block[Object.keys(recordMap.block)[0]])
  if (root?.type !== "page" || !root.content) return boundaries

  let sincePreviousAd = 0
  for (let index = 0; index < root.content.length - 4; index++) {
    const block = unwrapBlock(recordMap.block[root.content[index]])
    if (!block || block.parent_id !== root.id) continue
    sincePreviousAd++
    if (sincePreviousAd < 8 || (block.type !== "code" && block.type !== "equation")) continue
    boundaries.add(block.id)
    sincePreviousAd = 0
  }
  return boundaries
}
