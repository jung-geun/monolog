import type { ExtendedRecordMap, Block } from "notion-types"
import type { TPost, TNotionDatabase } from "src/types"
import { getBlockById } from "src/libs/utils/notion/unwrapBlock"
import { normalizeNotionId, buildIdToSlug } from "src/libs/utils/notion/rewriteInternalLinks"
import { customMapImageUrl } from "src/libs/utils/notion/customMapImageUrl"
import { getArticleHeadings } from "src/routes/Detail/components/NotionRenderer/headings"
import { getArticleDescription } from "src/libs/utils/notion/articleSummary"
import { publishedDate, modifiedDate, summaryText } from "src/libs/seo"

/**
 * Escapes special Markdown characters in ordinary text.
 * ordinary text escaping: \, *, _, [, ], <, >, |
 */
function escapeMarkdownText(text: string): string {
  if (!text) return ""
  return text.replace(/([\\*_[\]<>|])/g, "\\$1")
}

/**
 * Validates and normalizes URL destinations for Markdown links/media.
 * Allowed schemes: root-relative (/...), fragment (#...), http:, https:, mailto:
 * Unsafe/unsupported schemes return null.
 * Root-relative URLs are absolutized using siteUrl.
 * Destinations have spaces and parentheses escaped.
 */
function normalizeLinkUrl(url: string | undefined | null, siteUrl: string): string | null {
  if (!url || typeof url !== "string") return null
  const trimmed = url.trim()
  if (!trimmed) return null

  let resolved = trimmed
  if (trimmed.startsWith("/")) {
    resolved = `${siteUrl}${trimmed}`
  } else if (trimmed.startsWith("#")) {
    resolved = trimmed
  } else {
    const lower = trimmed.toLowerCase()
    if (
      !lower.startsWith("http://") &&
      !lower.startsWith("https://") &&
      !lower.startsWith("mailto:")
    ) {
      return null
    }
  }

  // Escape spaces and parentheses in Markdown destinations
  return resolved
    .replace(/ /g, "%20")
    .replace(/\(/g, "\\(")
    .replace(/\)/g, "\\)")
}

/**
 * Calculates a backtick fence string that is strictly longer than any run of backticks in text.
 */
function makeBacktickFence(text: string, minLength = 1): string {
  const matches = text.match(/`+/g)
  let maxLen = 0
  if (matches) {
    for (const m of matches) {
      if (m.length > maxLen) maxLen = m.length
    }
  }
  const fenceLength = Math.max(minLength, maxLen + 1)
  return "`".repeat(fenceLength)
}

/**
 * Renders legacy Notion rich text segments to Markdown.
 * Segment format: [text, [ [decoration_type, ...args], ... ]] or [text]
 */
function renderRichText(
  richTextArray: unknown[] | undefined | null,
  idToSlug: Map<string, string>,
  siteUrl: string,
  inTable = false
): string {
  if (!richTextArray || !Array.isArray(richTextArray) || richTextArray.length === 0) {
    return ""
  }

  let result = ""

  for (const segment of richTextArray) {
    if (!Array.isArray(segment)) continue
    const rawText: string = typeof segment[0] === "string" ? segment[0] : ""
    const decorations: unknown[][] = Array.isArray(segment[1]) ? (segment[1] as unknown[][]) : []

    let hasCode = false
    let isBold = false
    let isItalic = false
    let isStrikethrough = false
    let isUnderline = false
    let isEquation = false
    let equationExpr: string | null = null
    let linkUrl: string | null = null
    let hasLink = false

    for (const dec of decorations) {
      if (!Array.isArray(dec) || dec.length === 0) continue
      const type = dec[0]

      switch (type) {
        case "c":
          hasCode = true
          break
        case "b":
          isBold = true
          break
        case "i":
          isItalic = true
          break
        case "s":
          isStrikethrough = true
          break
        case "_":
          isUnderline = true
          break
        case "e":
          isEquation = true
          if (typeof dec[1] === "string") {
            equationExpr = dec[1]
          }
          break
        case "a": {
          hasLink = true
          const target = typeof dec[1] === "string" ? dec[1] : ""
          linkUrl = normalizeLinkUrl(target, siteUrl)
          break
        }
        case "p": {
          hasLink = true
          const targetId = typeof dec[1] === "string" ? dec[1] : ""
          const normId = normalizeNotionId(targetId)
          const slug = idToSlug.get(normId)
          linkUrl = slug ? `${siteUrl}/${encodeURIComponent(slug)}` : null
          break
        }
        // "h" (color) ignored while text stays
        // user/date/link-mention/unknown retain text
        default:
          break
      }
    }

    // 1. Text / Code / Equation (innermost)
    let segmentContent = ""
    if (isEquation) {
      const expr = equationExpr !== null ? equationExpr : rawText
      segmentContent = `$${expr}$`
    } else if (hasCode) {
      // GFM consumes a backslash before a table pipe even inside backticks.
      // Entity-safe inline HTML preserves literal backslash/pipe sequences.
      if (inTable && rawText.includes("\\|")) {
        const literal = rawText.replace(/[^\p{L}\p{N} \t\r\n]/gu, char => `&#${char.codePointAt(0)};`)
        segmentContent = `<code>${literal}</code>`
      } else {
        const fence = makeBacktickFence(rawText, 1)
        segmentContent = `${fence}${rawText}${fence}`
      }
    } else {
      segmentContent = escapeMarkdownText(rawText)
    }

    // 2. Emphasis wrappers (bold, italic, strikethrough, underline)
    if (isBold) segmentContent = `**${segmentContent}**`
    if (isItalic) segmentContent = `*${segmentContent}*`
    if (isStrikethrough) segmentContent = `~~${segmentContent}~~`
    if (isUnderline) segmentContent = `<u>${segmentContent}</u>`

    // 3. Link (outermost)
    if (hasLink) {
      if (linkUrl) {
        segmentContent = `[${segmentContent}](${linkUrl})`
      }
      // If linkUrl is null (e.g. unsafe scheme or unmapped page id), plain text remains
    }

    result += segmentContent
  }

  return result
}

function getRichTextPlainText(richTextArray: unknown[] | undefined | null): string {
  if (!richTextArray || !Array.isArray(richTextArray)) return ""
  let text = ""
  for (const seg of richTextArray) {
    if (Array.isArray(seg) && typeof seg[0] === "string") {
      text += seg[0]
    }
  }
  return text
}

/** Inclusive, 1-based lines in the final Markdown, including nested block spans. */
export interface MarkdownBlockRange {
  blockId: string
  startLine: number
  endLine: number
}

export type MarkdownSourceMap = MarkdownBlockRange[]

export interface MarkdownDocument {
  markdown: string
  blocks: MarkdownSourceMap
}

interface MappingContext {
  prefix: string
  blocks: string[]
}

function markChunk(chunk: string, blockId: string, mapping?: MappingContext): string {
  if (!mapping || !chunk) return chunk
  // Close before trailing newlines so ancestor quote prefixes do not extend a child span.
  const end = chunk.trimEnd().length
  if (!end) return chunk
  const index = mapping.blocks.push(normalizeNotionId(blockId)) - 1
  return `${mapping.prefix}${index}:s\0${chunk.slice(0, end)}${mapping.prefix}${index}:e\0${chunk.slice(end)}`
}

// Markers are inline, so quote/list indentation sees exactly the same newlines.
// Strip before trimming: an end marker must never preserve otherwise-trimmed bytes.
function resolveSourceMap(marked: string, mapping: MappingContext): MarkdownDocument {
  const marker = new RegExp(`${mapping.prefix}(\\d+):([se])\\0`, "g")
  const pieces: string[] = []
  const spans: { blockId: string; start: number; end: number }[] = []
  const open = new Map<number, { blockId: string; start: number; end: number }>()
  let cursor = 0
  let offset = 0
  let match: RegExpExecArray | null
  while ((match = marker.exec(marked))) {
    const text = marked.slice(cursor, match.index)
    pieces.push(text)
    offset += text.length
    const index = Number(match[1])
    if (match[2] === "s") {
      const span = { blockId: mapping.blocks[index], start: offset, end: offset }
      spans.push(span)
      open.set(index, span)
    } else {
      const span = open.get(index)
      if (span) span.end = offset
      open.delete(index)
    }
    cursor = marker.lastIndex
  }
  pieces.push(marked.slice(cursor))
  const content = pieces.join("").trimEnd()
  const lineStarts = [0]
  for (let i = 0; i < content.length; i++) {
    if (content[i] === "\n") lineStarts.push(i + 1)
  }
  const lineAt = (position: number): number => {
    let low = 0
    let high = lineStarts.length
    while (low + 1 < high) {
      const mid = (low + high) >>> 1
      if (lineStarts[mid] <= position) low = mid
      else high = mid
    }
    return low + 1
  }
  const blocks: MarkdownBlockRange[] = []
  for (const span of spans) {
    let start = span.start
    let end = Math.min(span.end, content.length)
    while (start < end && /\s/.test(content[start])) start++
    while (end > start && /\s/.test(content[end - 1])) end--
    if (start < end) {
      blocks.push({ blockId: span.blockId, startLine: lineAt(start), endLine: lineAt(end - 1) })
    }
  }
  return { markdown: content + "\n", blocks }
}

interface RenderContext {
  post: TPost
  recordMap: ExtendedRecordMap
  databases: ReadonlyMap<string, TNotionDatabase>
  idToSlug: Map<string, string>
  siteUrl: string
  visitedIds: Set<string>
  listLevel: number
  headingLevels: Record<string, number>
  mapping?: MappingContext
}

function renderBlockChildren(
  childIds: string[] | undefined | null,
  ctx: RenderContext
): string[] {
  if (!childIds || !Array.isArray(childIds)) return []
  const chunks: string[] = []

  for (const childId of childIds) {
    if (ctx.visitedIds.has(childId)) continue
    const childBlock = getBlockById(ctx.recordMap, childId)
    if (!childBlock) continue

    const childChunk = renderBlock(childBlock, ctx)
    if (childChunk) {
      chunks.push(childChunk)
    }
  }

  return chunks
}

function indentChunk(chunk: string, indent: string): string {
  return chunk
    .split("\n")
    .map((line) => `${indent}${line}`)
    .join("\n")
}


function renderBlock(block: Block, ctx: RenderContext): string {
  return markChunk(renderBlockContent(block, ctx), block.id, ctx.mapping)
}

function renderBlockContent(block: Block, ctx: RenderContext): string {
  ctx.visitedIds.add(block.id)

  const type = block.type as string
  const props = block.properties
  const format = block.format

  switch (type) {
    case "text":
    case "paragraph": {
      const text = renderRichText(props?.title, ctx.idToSlug, ctx.siteUrl)
      const childChunks = renderBlockChildren(block.content, ctx)
      if (!text && childChunks.length === 0) return ""
      if (childChunks.length > 0) {
        const childrenText = childChunks.join("\n\n")
        return text ? `${text}\n\n${childrenText}` : childrenText
      }
      return text
    }

    case "header":
    case "sub_header":
    case "sub_sub_header":
    case "header_4": {
      const text = renderRichText(props?.title, ctx.idToSlug, ctx.siteUrl)
      const level = ctx.headingLevels[block.id] ?? 2
      const heading = `${"#".repeat(level)} ${text}`
      const childChunks = format && "toggleable" in format && format.toggleable
        ? renderBlockChildren(block.content, ctx)
        : []
      return childChunks.length ? `${heading}\n\n${childChunks.join("\n\n")}` : heading
    }

    case "bulleted_list": {
      const text = renderRichText(props?.title, ctx.idToSlug, ctx.siteUrl)
      const indent = "  ".repeat(ctx.listLevel)
      const line = `${indent}- ${text}`

      const childCtx = { ...ctx, listLevel: ctx.listLevel + 1 }
      const childChunks = renderBlockChildren(block.content, childCtx)
      if (childChunks.length > 0) {
        return `${line}\n${childChunks.join("\n")}`
      }
      return line
    }

    case "numbered_list": {
      const text = renderRichText(props?.title, ctx.idToSlug, ctx.siteUrl)
      const indent = "  ".repeat(ctx.listLevel)
      const line = `${indent}1. ${text}`

      const childCtx = { ...ctx, listLevel: ctx.listLevel + 1 }
      const childChunks = renderBlockChildren(block.content, childCtx)
      if (childChunks.length > 0) {
        return `${line}\n${childChunks.join("\n")}`
      }
      return line
    }

    case "to_do": {
      const text = renderRichText(props?.title, ctx.idToSlug, ctx.siteUrl)
      const isChecked = props?.checked?.[0]?.[0] === "Yes"
      const checkbox = isChecked ? "[x]" : "[ ]"
      const indent = "  ".repeat(ctx.listLevel)
      const line = `${indent}- ${checkbox} ${text}`

      const childCtx = { ...ctx, listLevel: ctx.listLevel + 1 }
      const childChunks = renderBlockChildren(block.content, childCtx)
      if (childChunks.length > 0) {
        return `${line}\n${childChunks.join("\n")}`
      }
      return line
    }

    case "toggle": {
      const text = renderRichText(props?.title, ctx.idToSlug, ctx.siteUrl)
      const indent = "  ".repeat(ctx.listLevel)
      const line = `${indent}- **${text}**`

      const childChunks = renderBlockChildren(block.content, ctx)
      if (childChunks.length > 0) {
        const childIndent = "  ".repeat(ctx.listLevel + 1)
        return `${line}\n${childChunks.map((chunk) => indentChunk(chunk, childIndent)).join("\n")}`
      }
      return line
    }

    case "quote":
    case "callout": {
      const text = renderRichText(props?.title, ctx.idToSlug, ctx.siteUrl)
      const childChunks = renderBlockChildren(block.content, ctx)
      let combined = text
      if (childChunks.length > 0) {
        const childrenText = childChunks.join("\n\n")
        combined = text ? `${text}\n\n${childrenText}` : childrenText
      }

      if (!combined) return ""
      const lines = combined.split("\n")
      return lines.map((l) => `> ${l}`).join("\n")
    }

    case "code": {
      const rawCode = props?.title?.[0]?.[0] || getRichTextPlainText(props?.title) || ""
      const fence = makeBacktickFence(rawCode, 3)

      let lang = props?.language?.[0]?.[0]
      let langTag = ""
      if (
        typeof lang === "string" &&
        lang !== "plain text" &&
        /^[A-Za-z0-9_+-]+$/.test(lang)
      ) {
        langTag = lang
      }

      const codeBlock = `${fence}${langTag}\n${rawCode}\n${fence}`
      const caption = renderRichText(props?.caption, ctx.idToSlug, ctx.siteUrl)
      if (caption) {
        return `${codeBlock}\n*${caption}*`
      }
      return codeBlock
    }

    case "equation": {
      const expr = props?.title?.[0]?.[0] || getRichTextPlainText(props?.title) || ""
      return `$$\n${expr}\n$$`
    }

    case "divider": {
      return "---"
    }

    case "image": {
      const rawSource = props?.source?.[0]?.[0] || format?.display_source || ""
      const caption = renderRichText(props?.caption, ctx.idToSlug, ctx.siteUrl)
      const plainCaption = getRichTextPlainText(props?.caption)

      if (!rawSource) {
        return caption
      }

      let mappedUrl = ""
      try {
        mappedUrl = customMapImageUrl(rawSource, block, {
          pageId: ctx.post.id,
          source: "block",
        })
      } catch {
        return caption
      }

      const validUrl = normalizeLinkUrl(mappedUrl, ctx.siteUrl)
      if (!validUrl) {
        return caption
      }

      const altText = plainCaption || "image"
      return `![${altText}](${validUrl})`
    }

    case "video":
    case "audio":
    case "file":
    case "pdf":
    case "embed": {
      const rawSource = props?.source?.[0]?.[0] || format?.display_source || ""
      const caption = renderRichText(props?.caption, ctx.idToSlug, ctx.siteUrl)
      const plainCaption = getRichTextPlainText(props?.caption)

      const validUrl = normalizeLinkUrl(rawSource, ctx.siteUrl)
      if (!validUrl) {
        return caption
      }

      const label = plainCaption || caption || type
      return `[${label}](${validUrl})`
    }

    case "bookmark": {
      const rawUrl = props?.link?.[0]?.[0] || ""
      const validUrl = normalizeLinkUrl(rawUrl, ctx.siteUrl)

      const titleRich = renderRichText(props?.title, ctx.idToSlug, ctx.siteUrl)
      const plainTitle = getRichTextPlainText(props?.title)
      const descRich = renderRichText(props?.description, ctx.idToSlug, ctx.siteUrl)

      const linkLabel = titleRich || plainTitle || escapeMarkdownText(rawUrl)

      if (validUrl) {
        const link = `[${linkLabel}](${validUrl})`
        return descRich ? `${link}\n\n${descRich}` : link
      } else {
        const titleText = titleRich || plainTitle
        return descRich ? `${titleText}\n\n${descRich}` : titleText
      }
    }

    case "page": {
      const title = renderRichText(props?.title, ctx.idToSlug, ctx.siteUrl)
      const normId = normalizeNotionId(block.id)
      const slug = ctx.idToSlug.get(normId)

      if (slug) {
        const canonicalUrl = `${ctx.siteUrl}/${encodeURIComponent(slug)}`
        return `- [${title}](${canonicalUrl})`
      }
      return `- ${title}`
    }

    case "collection_view_page": {
      const title = renderRichText(props?.title, ctx.idToSlug, ctx.siteUrl) || "Database"
      const database = ctx.databases.get(block.id)

      if (!database || !database.properties || database.properties.length === 0) {
        return title
      }

      // Render GFM Table
      const headers = database.properties.map((p) => escapeMarkdownText(p.name))
      const headerRow = `| ${headers.join(" | ")} |`
      const delimiterRow = `| ${headers.map(() => "---").join(" | ")} |`

      const rowLines: string[] = []
      for (const row of database.rows || []) {
        const cellValues: string[] = []
        for (const prop of database.properties) {
          const rawVal = row.values?.[prop.name]
          let formattedCell = formatDatabaseCellValue(rawVal, prop.type, ctx.siteUrl)

          // Escape pipes and replace newlines with <br>
          formattedCell = formattedCell.replace(/\|/g, "\\|").replace(/\n/g, "<br>")
          cellValues.push(formattedCell)
        }
        rowLines.push(markChunk(`| ${cellValues.join(" | ")} |`, row.id, ctx.mapping))
      }

      const tableMd = [headerRow, delimiterRow, ...rowLines].join("\n")
      return `${title}\n\n${tableMd}`
    }

    case "table": {
      const childRows: Block[] = []
      if (block.content) {
        for (const childId of block.content) {
          if (ctx.visitedIds.has(childId)) continue
          const childBlock = getBlockById(ctx.recordMap, childId)
          if (childBlock && childBlock.type === "table_row") {
            ctx.visitedIds.add(childId)
            childRows.push(childBlock)
          }
        }
      }

      if (childRows.length === 0) return ""

      const hasHeader = format?.table_block_column_header === true
      // RNX stores each cell under its column ID, not in a row-level array.
      // The declared order also preserves columns whose cells are all empty.
      const columnOrder: string[] = format?.table_block_column_order || []
      const colCount = columnOrder.length

      if (colCount === 0) return ""

      const renderRowCells = (rowBlock: Block): string[] => {
        const cells: string[] = []
        for (const column of columnOrder) {
          const cellRichText = rowBlock.properties?.[column]
          const renderedCell = renderRichText(cellRichText, ctx.idToSlug, ctx.siteUrl, true)
          // A pipe is escaped only after an odd number of backslashes in GFM.
          const escaped = renderedCell
            .replace(/\\*\|/g, (match) => match.length % 2 === 1 ? `\\${match}` : match)
            .replace(/\r\n?|\n/g, "<br>")
          cells.push(escaped)
        }
        return cells
      }

      let headerCells: string[] = []
      let bodyRows = childRows

      if (hasHeader) {
        headerCells = renderRowCells(childRows[0])
        bodyRows = childRows.slice(1)
      } else {
        headerCells = Array(colCount).fill("")
      }

      const headerLine = hasHeader
        ? markChunk(`| ${headerCells.join(" | ")} |`, childRows[0].id, ctx.mapping)
        : `| ${headerCells.join(" | ")} |`
      const delimiterLine = `| ${Array(colCount).fill("---").join(" | ")} |`

      const bodyLines = bodyRows.map((r) => markChunk(`| ${renderRowCells(r).join(" | ")} |`, r.id, ctx.mapping))

      return [headerLine, delimiterLine, ...bodyLines].join("\n")
    }

    case "column_list":
    case "column":
    case "table_of_contents": {
      const childChunks = renderBlockChildren(block.content, ctx)
      return childChunks.join("\n\n")
    }

    default: {
      const title = renderRichText(props?.title, ctx.idToSlug, ctx.siteUrl)
      const childChunks = renderBlockChildren(block.content, ctx)
      if (title && childChunks.length > 0) {
        return `${title}\n\n${childChunks.join("\n\n")}`
      }
      if (title) return title
      return childChunks.join("\n\n")
    }
  }
}

function formatDatabaseCellValue(
  value: unknown,
  propType: string,
  siteUrl: string
): string {
  if (value === null || value === undefined) return ""

  if (Array.isArray(value)) {
    return value.map((v) => formatDatabaseCellValue(v, propType, siteUrl)).join(", ")
  }

  if (typeof value === "boolean") {
    return value ? "true" : "false"
  }

  if (typeof value === "object") {
    const obj = value as Record<string, unknown>
    if ("start_date" in obj || "start" in obj) {
      const start = String(obj.start_date || obj.start || "")
      const end = String(obj.end_date || obj.end || "")
      return end ? `${start} → ${end}` : start
    }
    if ("url" in obj && typeof obj.url === "string") {
      const valid = normalizeLinkUrl(obj.url, siteUrl)
      return valid ? `[${escapeMarkdownText(obj.url)}](${valid})` : escapeMarkdownText(obj.url)
    }
  }

  if (propType === "url" || propType === "files") {
    const str = String(value)
    const valid = normalizeLinkUrl(str, siteUrl)
    return valid ? `[${escapeMarkdownText(str)}](${valid})` : escapeMarkdownText(str)
  }

  return escapeMarkdownText(String(value))
}

export function renderPostMarkdown(
  post: TPost,
  recordMap: ExtendedRecordMap,
  databases: ReadonlyMap<string, TNotionDatabase>,
  options: { siteUrl: string; allPosts: ReadonlyArray<Pick<TPost, "id" | "slug">> }
): string {
  return renderPost(post, recordMap, databases, options)
}

export function renderPostMarkdownDocument(
  post: TPost,
  recordMap: ExtendedRecordMap,
  databases: ReadonlyMap<string, TNotionDatabase>,
  options: { siteUrl: string; allPosts: ReadonlyArray<Pick<TPost, "id" | "slug">> }
): MarkdownDocument {
  // Private sentinels only: Web Crypto also works outside secure browser contexts,
  // unlike randomUUID. They are stripped before computing exported bytes/spans.
  const nonce = Array.from(globalThis.crypto.getRandomValues(new Uint32Array(4)), word => word.toString(16).padStart(8, "0")).join("")
  const mapping: MappingContext = { prefix: `\0${nonce}:`, blocks: [] }
  return resolveSourceMap(renderPost(post, recordMap, databases, options, mapping), mapping)
}

function renderPost(
  post: TPost,
  recordMap: ExtendedRecordMap,
  databases: ReadonlyMap<string, TNotionDatabase>,
  options: { siteUrl: string; allPosts: ReadonlyArray<Pick<TPost, "id" | "slug">> },
  mapping?: MappingContext
): string {
  const rootBlock = getBlockById(recordMap, post.id)
  if (!rootBlock) {
    throw new Error(`Root block not found in recordMap for post id: ${post.id}`)
  }

  const baseUrl = options.siteUrl.replace(/\/$/, "")
  const idToSlug = buildIdToSlug(options.allPosts)

  // Build Frontmatter
  const frontmatterLines: string[] = ["---"]

  // 1. title
  frontmatterLines.push(`title: ${JSON.stringify(post.title || "")}`)

  // 2. description: author Summary, else deterministic body excerpt
  const description = getArticleDescription(summaryText(post.summary), recordMap, post.id)
  if (description) {
    frontmatterLines.push(`description: ${JSON.stringify(description)}`)
  }

  // 3. date (valid ISO only)
  const published = publishedDate(post)
  if (published) {
    frontmatterLines.push(`date: ${JSON.stringify(published)}`)
  }

  // 4. last_modified (content modification, valid ISO only)
  const modified = modifiedDate(post)
  if (modified) {
    frontmatterLines.push(`last_modified: ${JSON.stringify(modified)}`)
  }

  // 5. type (first post.type value)
  const mainType = post.type?.[0] || "Post"
  frontmatterLines.push(`type: ${JSON.stringify(mainType)}`)

  // Helper for YAML sequences
  const addSequence = (key: string, items: string[] | undefined) => {
    if (items && Array.isArray(items) && items.length > 0) {
      frontmatterLines.push(`${key}:`)
      for (const item of items) {
        frontmatterLines.push(`  - ${JSON.stringify(item)}`)
      }
    }
  }

  // 6. tags
  addSequence("tags", post.tags)

  // 7. categories
  addSequence("categories", post.category)

  // 8. series
  addSequence("series", post.series)

  // 9. authors
  const authorNames = post.author?.map((a) => a.name).filter(Boolean)
  addSequence("authors", authorNames)

  // 10. canonical_url
  const encodedSlug = encodeURIComponent(post.slug)
  frontmatterLines.push(`canonical_url: ${JSON.stringify(`${baseUrl}/${encodedSlug}`)}`)

  // 11. markdown_url
  frontmatterLines.push(`markdown_url: ${JSON.stringify(`${baseUrl}/${encodedSlug}.md`)}`)

  frontmatterLines.push("---")
  const frontmatter = frontmatterLines.join("\n")

  // Root traversal
  const visitedIds = new Set<string>()
  if (post.id) {
    visitedIds.add(post.id)
  }

  const renderCtx: RenderContext = {
    post,
    recordMap,
    databases,
    idToSlug,
    siteUrl: baseUrl,
    visitedIds,
    listLevel: 0,
    headingLevels: Object.fromEntries(getArticleHeadings(recordMap, post.id).map(({ block, level }) => [block.id, level])),
    mapping,
  }

  const childIds = rootBlock?.content || []
  const bodyChunks: string[] = []

  for (const childId of childIds) {
    if (visitedIds.has(childId)) continue
    const childBlock = getBlockById(recordMap, childId)
    if (!childBlock) continue

    const chunk = renderBlock(childBlock, renderCtx)
    if (chunk) {
      bodyChunks.push(chunk)
    }
  }

  // Section assembly: Frontmatter -> H1 Title -> Summary -> Body Chunks
  const titleH1 = `# ${escapeMarkdownText(post.title || "")}`

  const topSections: string[] = [frontmatter, markChunk(titleH1, "title", mapping)]

  if (description) {
    topSections.push(markChunk(escapeMarkdownText(description), "summary", mapping))
  }

  if (bodyChunks.length > 0) {
    topSections.push(...bodyChunks)
  }

  const result = topSections.join("\n\n")
  if (mapping) return result
  return result.trimEnd() + "\n"
}
