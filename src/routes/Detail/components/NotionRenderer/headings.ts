import type { Block, ExtendedRecordMap } from "notion-types"
import { getBlockById } from "src/libs/utils/notion/unwrapBlock"

type HeadingType = "header" | "sub_header" | "sub_sub_header" | "header_4"
export type ArticleHeading = { block: Block; level: number }

const headingRanks: Record<string, number> = {
  header: 1,
  sub_header: 2,
  sub_sub_header: 3,
  header_4: 4,
}
const headingTypes: Record<number, HeadingType> = {
  2: "header",
  3: "sub_header",
  4: "sub_sub_header",
  5: "header_4",
}

/** Body order, not recordMap insertion order; linked child pages are not sections. */
export function getArticleHeadings(
  recordMap: ExtendedRecordMap | null,
  rootId?: string
): ArticleHeading[] {
  if (!recordMap) return []
  const root = getBlockById(recordMap, rootId ?? Object.keys(recordMap.block)[0])
  if (!root) return []
  const headings: Block[] = []
  const visited = new Set<string>([root.id])
  const visit = (id: string) => {
    if (visited.has(id)) return
    visited.add(id)
    const block = getBlockById(recordMap, id)
    if (!block) return
    if (headingRanks[block.type]) headings.push(block)
    if (block.type === "page" || block.type === "collection_view_page" || block.type === "collection_view") return
    if (block.type === "transclusion_reference") {
      const pointer = block.format?.transclusion_reference_pointer.id
      if (pointer) visit(pointer)
      return
    }
    // Non-toggle headings do not render children in react-notion-x.
    if (headingRanks[block.type] && !(block.format && "toggleable" in block.format && block.format.toggleable)) return
    block.content?.forEach(visit)
  }
  root.content?.forEach(visit)

  const usedRanks = Array.from(new Set(headings.map((block) => headingRanks[block.type]))).sort((a, b) => a - b)
  const levels: Record<number, number> = {}
  usedRanks.forEach((rank, index) => { levels[rank] = index + 2 })
  let previous = 1
  return headings.map((block) => {
    // Compress unused levels and prevent a downward jump even if the article
    // starts with a lower-ranked heading before its first top-level section.
    const level = Math.min(levels[headingRanks[block.type]], previous + 1)
    previous = level
    return { block, level }
  })
}

/** RNX has no section-heading component slot; its four block types emit h2–h5. */
export function normalizeArticleHeadings(
  recordMap: ExtendedRecordMap | null,
  rootId?: string
): ExtendedRecordMap | null {
  if (!recordMap) return null
  let blocks: ExtendedRecordMap["block"] | undefined
  for (const { block, level } of getArticleHeadings(recordMap, rootId)) {
    const type = headingTypes[level]
    if (block.type === type) continue
    const boxed = recordMap.block[block.id]
    if (!boxed) continue
    const value = boxed.value
    const normalized = { ...block, type } as Block
    blocks ??= { ...recordMap.block }
    blocks[block.id] = "value" in value && "role" in value
      ? { ...boxed, value: { ...value, value: normalized } }
      : { ...boxed, value: normalized }
  }
  return blocks ? { ...recordMap, block: blocks } : recordMap
}
