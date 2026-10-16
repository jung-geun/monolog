import type { Block, Decoration, ExtendedRecordMap } from "notion-types"
import { unwrapBlock } from "./unwrapBlock"

export type InlineMathPart =
  | { type: "text"; text: string }
  | { type: "math"; text: string; math: string; displayMode: boolean }

// RNX forwards only the e decorator's string to Equation. Keep the original
// delimiters in that string so display math survives its inline-only e slot.
const delimiters = [
  { left: "$$", right: "$$", displayMode: true },
  { left: "$", right: "$", displayMode: false },
  { left: "\\(", right: "\\)", displayMode: false },
  { left: "\\[", right: "\\]", displayMode: true },
] as const

/** Split prose without changing any source bytes, including unmatched dollars. */
export function parseInlineMath(text: string): InlineMathPart[] {
  const parts: InlineMathPart[] = []
  let plainStart = 0
  let index = 0
  while (index < text.length) {
    const delimiter = delimiters.find(({ left }) => text.startsWith(left, index))
    if (!delimiter) {
      // An escaped opening delimiter is prose, not a second opening token.
      index += text[index] === "\\" ? 2 : 1
      continue
    }
    const mathStart = index + delimiter.left.length
    let end = mathStart
    let braceLevel = 0
    while (end < text.length) {
      if (braceLevel <= 0 && text.startsWith(delimiter.right, end)) break
      if (text[end] === "\\") {
        end += 2
        continue
      }
      if (text[end] === "{") braceLevel++
      else if (text[end] === "}") braceLevel--
      end++
    }
    // Like KaTeX auto-render, never reinterpret an unmatched opener as a
    // shorter delimiter or eat the rest of a sentence containing a price.
    if (end >= text.length) break
    if (index > plainStart) parts.push({ type: "text", text: text.slice(plainStart, index) })
    const next = end + delimiter.right.length
    parts.push({ type: "math", text: text.slice(index, next), math: text.slice(mathStart, end), displayMode: delimiter.displayMode })
    index = next
    plainStart = next
  }
  if (plainStart < text.length) parts.push({ type: "text", text: text.slice(plainStart) })
  return parts
}

const proseTitleTypes: Record<string, true> = {
  page: true, text: true, header: true, sub_header: true, sub_sub_header: true, header_4: true,
  bulleted_list: true, numbered_list: true, to_do: true, toggle: true, quote: true, callout: true, file: true,
}
const protectedDecorations: Record<string, true> = { c: true, e: true, p: true, u: true, "‣": true, d: true, lm: true, eoi: true }

function normalizeRichText(value: Decoration[]): Decoration[] {
  let normalized: Decoration[] | undefined
  value.forEach((segment, index) => {
    const [text, decorations] = segment
    if (decorations?.some(([kind]) => protectedDecorations[kind])) {
      normalized?.push(segment)
      return
    }
    const parts = parseInlineMath(text)
    if (!parts.some((part) => part.type === "math")) {
      normalized?.push(segment)
      return
    }
    normalized ??= value.slice(0, index)
    for (const part of parts) {
      if (part.type === "text") {
        normalized.push(decorations ? [part.text, decorations] : [part.text])
      } else {
        // e comes first: subsequent bold/color/link decorators wrap Equation
        // rather than being discarded by RNX's e reducer branch.
        normalized.push([part.text, [["e", part.text], ...(decorations ?? [])]])
      }
    }
  })
  return normalized ?? value
}

/** Copy on write; cached/source maps and non-prose properties remain untouched. */
export function normalizeInlineMath(recordMap: ExtendedRecordMap | null): ExtendedRecordMap | null {
  if (!recordMap) return null
  let blocks: ExtendedRecordMap["block"] | undefined
  for (const [id, boxed] of Object.entries(recordMap.block)) {
    const block = unwrapBlock(boxed)
    if (!boxed || !block?.properties || block.type === "equation") continue
    let properties: Record<string, Decoration[]> | undefined
    for (const [key, value] of Object.entries(block.properties)) {
      const prose = key === "caption"
        || (key === "title" && proseTitleTypes[block.type])
        || (key === "description" && block.type === "bookmark")
        || block.type === "table_row"
      if (!prose || !Array.isArray(value)) continue
      const normalized = normalizeRichText(value)
      if (normalized === value) continue
      properties ??= { ...block.properties } as Record<string, Decoration[]>
      properties[key] = normalized
    }
    if (!properties) continue
    const normalized = { ...block, properties } as Block
    const value = boxed.value
    blocks ??= { ...recordMap.block }
    blocks[id] = "value" in value && "role" in value
      ? { ...boxed, value: { ...value, value: normalized } }
      : { ...boxed, value: normalized }
  }
  return blocks ? { ...recordMap, block: blocks } : recordMap
}
