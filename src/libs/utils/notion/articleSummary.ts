import type { ExtendedRecordMap } from "notion-types"
import { getBlockById } from "src/libs/utils/notion/unwrapBlock"
import { getNotionRichTextPlainText } from "src/libs/utils/notion/richText"

export const ARTICLE_EXCERPT_MAX_LENGTH = 200

const proseTypes: Record<string, true> = { text: true, quote: true, callout: true }
const containerTypes: Record<string, true> = {
  column_list: true,
  column: true,
  transclusion_container: true,
}

const clip = (text: string, maxLength: number) => {
  if (text.length <= maxLength) return text
  const head = text.slice(0, maxLength)
  const sentenceEnd = Math.max(head.lastIndexOf(". "), head.lastIndexOf("? "), head.lastIndexOf("! "))
  if (sentenceEnd >= maxLength / 2) return head.slice(0, head.indexOf(" ", sentenceEnd)).trim()
  const space = head.lastIndexOf(" ")
  return `${(space >= maxLength / 2 ? head.slice(0, space) : head).trim()}…`
}

/**
 * First meaningful prose paragraph/quote/callout in rendered body order.
 * Headings, code, math, media, lists, child pages and databases are skipped.
 */
export function getArticleExcerpt(
  recordMap: ExtendedRecordMap | null | undefined,
  rootId?: string,
  maxLength = ARTICLE_EXCERPT_MAX_LENGTH
): string {
  if (!recordMap) return ""
  const root = getBlockById(recordMap, rootId ?? Object.keys(recordMap.block)[0])
  if (!root) return ""
  const visited = new Set<string>([root.id])
  const find = (ids: string[] | undefined): string => {
    for (const id of ids ?? []) {
      if (visited.has(id)) continue
      visited.add(id)
      const block = getBlockById(recordMap, id)
      if (!block) continue
      if (proseTypes[block.type]) {
        // Notion stores inline mentions/equations as placeholder glyphs (‣, ⁍).
        const text = getNotionRichTextPlainText(block.properties?.title).replace(/[‣⁍]/g, "").replace(/\s+/g, " ").trim()
        if (text) return text
      }
      if (block.type === "transclusion_reference") {
        const pointer = block.format?.transclusion_reference_pointer.id
        const text = pointer ? find([pointer]) : ""
        if (text) return text
        continue
      }
      if (containerTypes[block.type] || proseTypes[block.type]) {
        const text = find(block.content)
        if (text) return text
      }
    }
    return ""
  }
  const excerpt = find(root.content)
  return excerpt ? clip(excerpt, maxLength) : ""
}

/** Author Summary wins verbatim; otherwise the deterministic body excerpt. */
export function getArticleDescription(
  summary: string,
  recordMap: ExtendedRecordMap | null | undefined,
  rootId?: string
): string {
  return summary.trim() || getArticleExcerpt(recordMap, rootId)
}
