import type { Block, ExtendedRecordMap } from "notion-types"
import { parsePageId } from "notion-utils"
import { parseInlineMath } from "src/libs/utils/notion/inlineMath"
import { normalizeNotionId } from "src/libs/utils/notion/rewriteInternalLinks"
import { unwrapBlock } from "src/libs/utils/notion/unwrapBlock"

export interface TranslationArticle {
  title: string
  summary: string
  recordMap: ExtendedRecordMap | null
}

export interface TranslationPlan {
  texts: string[]
  apply(translations: ReadonlyMap<number, string>): TranslationArticle
}

type TextSpan = { start: number; end: number; index: number }
type TextPlan = { original: string; spans: TextSpan[] }
type RichTextPlan = { original: unknown[]; fragments: Map<number, TextPlan> }
type BlockPlan = { block: Block; properties: Map<string, RichTextPlan> }

const proseTypes: Record<string, true | undefined> = {
  text: true, paragraph: true, header: true, sub_header: true, sub_sub_header: true, header_4: true,
  bulleted_list: true, numbered_list: true, to_do: true, quote: true, callout: true, toggle: true,
}
const treeBoundaries: Record<string, true | undefined> = {
  page: true, collection_view_page: true, collection_view: true, alias: true, link_to_page: true,
}
const protectedDecorations: Record<string, true | undefined> = {
  c: true, e: true, p: true, u: true, d: true, "‣": true, lm: true, eoi: true,
}

// RNX AssetWrapper's private isValidURL is not exported (isUrl is a different
// helper). Keep its exact pattern here so scheme-less image navigation agrees.
const assetNavigationURL = /^(https?:\/\/)?((([a-z\d]([a-z\d-]*[a-z\d])*)\.)+[a-z]{2,}|((\d{1,3}\.){3}\d{1,3}))(:\d+)?(\/[-a-z\d%_.~+]*)*(\?[;&a-z\d%_.~+=-]*)?(#[-a-z\d_]*)?$/i

function isImageNavigationCaption(value: unknown): boolean {
  if (!Array.isArray(value) || !Array.isArray(value[0])) return false
  const caption = value[0][0]
  return typeof caption === "string" && (
    assetNavigationURL.test(caption) || (caption.startsWith("/") && !!parsePageId(caption, { uuid: true }))
  )
}

function readBlock(entry: ExtendedRecordMap["block"][string]): Block | undefined {
  let value: unknown = unwrapBlock(entry)
  // Cached maps can have more value/role envelopes than unwrapBlock's usual two.
  while (value && typeof value === "object" && "value" in value && "role" in value) {
    value = value.value
  }
  return value && typeof value === "object" && "type" in value && "id" in value
    ? value as Block
    : undefined
}

function replaceBlock(envelope: unknown, original: Block, replacement: Block): unknown {
  if (envelope === original) return replacement
  if (!envelope || typeof envelope !== "object" || !("value" in envelope)) return envelope
  return { ...envelope, value: replaceBlock(envelope.value, original, replacement) }
}

function applyText(plan: TextPlan, translations: ReadonlyMap<number, string>): string {
  let result = ""
  let cursor = 0
  let changed = false
  for (const span of plan.spans) {
    const translated = translations.get(span.index)?.trim()
    if (!translated || translated === plan.original.slice(span.start, span.end)) continue
    result += plan.original.slice(cursor, span.start) + translated
    cursor = span.end
    changed = true
  }
  return changed ? result + plan.original.slice(cursor) : plan.original
}

function applyRichText(plan: RichTextPlan, translations: ReadonlyMap<number, string>): unknown[] {
  let result: unknown[] | undefined
  for (const [index, textPlan] of plan.fragments) {
    const translated = applyText(textPlan, translations)
    if (translated === textPlan.original) continue
    result ??= plan.original.slice()
    const fragment = plan.original[index] as unknown[]
    const next = fragment.slice()
    next[0] = translated
    result[index] = next
  }
  return result ?? plan.original
}

/**
 * Collects ordered, whitespace-trimmed sentence/phrase requests without translating.
 * Indexes address this plan only. Every apply starts from article, so missing/blank
 * results restore original text rather than retaining an earlier translation.
 * The caller owns the immutable source snapshot for the lifetime of the plan.
 */
export function createTranslationPlan(article: TranslationArticle, sourceLanguage: string): TranslationPlan {
  const texts: string[] = []
  const segmenter = new Intl.Segmenter(sourceLanguage, { granularity: "sentence" })

  const planText = (original: string): TextPlan => {
    const spans: TextSpan[] = []
    const collect = (start: number, end: number) => {
      const raw = original.slice(start, end)
      const text = raw.trim()
      // Preserve whitespace, placeholders, and punctuation-only phrases verbatim.
      if (!/[\p{L}\p{N}]/u.test(text)) return
      const offset = raw.length - raw.trimStart().length
      spans.push({ start: start + offset, end: start + offset + text.length, index: texts.length })
      texts.push(text)
    }
    const collectProse = (start: number, end: number) => {
      for (const sentence of segmenter.segment(original.slice(start, end))) {
        let cursor = start + sentence.index
        // A line break is a phrase boundary even without sentence punctuation.
        for (const line of sentence.segment.matchAll(/\r\n|\r|\n/g)) {
          const boundary = start + sentence.index + line.index!
          collect(cursor, boundary)
          cursor = boundary + line[0].length
        }
        collect(cursor, start + sentence.index + sentence.segment.length)
      }
    }
    const collectNonMath = (start: number, end: number) => {
      let cursor = start
      // Find URLs before sentence splitting, including conservative bare-domain
      // tokens. The explicit form also finds URLs inside surrounding punctuation.
      for (const token of original.slice(start, end).matchAll(/[^\s<>"'“”]+/g)) {
        const explicit = /(?:[a-z][a-z\d+.-]*:\/\/|mailto:|tel:|www\.)[^\s<>"'“”]+/i.exec(token[0])
        const bare = token[0].replace(/^[([{]+/, "").replace(/[.,!?;:)\]}]+$/, "")
        if (!explicit && !assetNavigationURL.test(bare)) continue
        const url = explicit?.[0] ?? bare
        const offset = explicit?.index ?? token[0].indexOf(bare)
        const boundary = start + token.index! + offset
        collectProse(cursor, boundary)
        cursor = boundary + url.length
      }
      collectProse(cursor, end)
    }
    let offset = 0
    for (const fragment of parseInlineMath(original)) {
      if (fragment.type === "text") collectNonMath(offset, offset + fragment.text.length)
      offset += fragment.text.length
    }
    return { original, spans }
  }

  const planRichText = (value: unknown): RichTextPlan | undefined => {
    if (!Array.isArray(value)) return undefined
    const fragments = new Map<number, TextPlan>()
    value.forEach((fragment: unknown, index: number) => {
      if (!Array.isArray(fragment) || typeof fragment[0] !== "string") return
      if (Array.isArray(fragment[1]) && fragment[1].some((decoration: unknown) => (
        Array.isArray(decoration) && protectedDecorations[decoration[0]] === true
      ))) return
      // Notion reference glyphs have no translatable label of their own.
      if (/^[\s‣⁍]*$/.test(fragment[0])) return
      // Relative links are also URL-only tokens, not words to translate.
      if (/^\s*(?:\/|#|\?)[^\s]+\s*$/.test(fragment[0])) return
      const plan = planText(fragment[0])
      if (plan.spans.length) fragments.set(index, plan)
    })
    return fragments.size ? { original: value, fragments } : undefined
  }

  const title = planText(article.title)
  const summary = planText(article.summary)
  const blockPlans = new Map<string, BlockPlan>()
  const recordMap = article.recordMap
  if (recordMap) {
    const keys = Object.keys(recordMap.block)
    const normalizedKeys = new Map(keys.map(key => [normalizeNotionId(key), key]))
    const visited = new Set<string>()
    const visit = (id: string, root = false, columnOrder?: string[]) => {
      const key = normalizedKeys.get(normalizeNotionId(id))
      if (!key || visited.has(key)) return
      visited.add(key)
      const block = readBlock(recordMap.block[key])
      if (!block || (!root && treeBoundaries[block.type])) return
      const properties = block.properties as Record<string, unknown> | undefined
      if (!root && properties && block.type !== "equation") {
        const plans = new Map<string, RichTextPlan>()
        const names = block.type === "table_row"
          ? [...new Set([...(columnOrder ?? []), ...Object.keys(properties)])]
          : block.type === "bookmark"
            ? ["title", "description", "caption"]
            : [...(proseTypes[block.type] ? ["title"] : []), "caption"]
        for (const name of names) {
          // RNX uses the first tuple as href and hides the entire caption.
          if (block.type === "image" && name === "caption" && isImageNavigationCaption(properties.caption)) continue
          const plan = planRichText(properties[name])
          if (plan) plans.set(name, plan)
        }
        if (plans.size) blockPlans.set(key, { block, properties: plans })
      }
      if (block.type === "code" || block.type === "equation") return
      if (block.type === "transclusion_reference") {
        const pointer = block.format?.transclusion_reference_pointer.id
        if (pointer) visit(pointer, false, columnOrder)
        return
      }
      const format = block.format as { table_block_column_order?: string[] } | undefined
      const order = block.type === "table" ? format?.table_block_column_order : columnOrder
      for (const child of block.content ?? []) visit(child, false, order)
    }
    // RNX, headings, and excerpts all identify the article root by the first key.
    if (keys.length) visit(keys[0], true)
  }

  return {
    texts,
    apply(translations) {
      const nextTitle = applyText(title, translations)
      const nextSummary = applyText(summary, translations)
      let blocks: ExtendedRecordMap["block"] | undefined
      if (recordMap) {
        for (const [key, plan] of blockPlans) {
          let properties: Record<string, unknown> | undefined
          for (const [name, richText] of plan.properties) {
            const translated = applyRichText(richText, translations)
            if (translated === richText.original) continue
            properties ??= { ...plan.block.properties } as Record<string, unknown>
            properties[name] = translated
          }
          if (!properties) continue
          blocks ??= { ...recordMap.block }
          const next = { ...plan.block, properties } as Block
          blocks[key] = replaceBlock(recordMap.block[key], plan.block, next) as ExtendedRecordMap["block"][string]
        }
      }
      const nextMap = blocks && recordMap ? { ...recordMap, block: blocks } : recordMap
      if (nextTitle === article.title && nextSummary === article.summary && nextMap === recordMap) return article
      return { title: nextTitle, summary: nextSummary, recordMap: nextMap }
    },
  }
}
