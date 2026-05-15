import { getOfficialNotionClient } from "./notionClient"
import { getPosts } from "./getPosts"
import { NotionGraph, NotionGraphEdge, NotionGraphNode, PostNode, RawEdge, SeriesNode, TagNode } from "src/types/notionGraph"
import { TPost } from "src/types"
import { CONFIG } from "site.config"
import { debugLog, warnLog } from "src/libs/utils/logger"
import { computeReadTime, readTimeTypeWeight } from "src/libs/utils/readTime"

const MAX_DEPTH = 2
const MAX_RETRIES = 5
const MAX_CONTEXTS = 3
const CONTEXT_LIMIT = 120
const CONCURRENCY = 4
const GRAPH_BUILD_TIMEOUT_MS = 25_000

async function notionRequest<T>(fn: () => Promise<T>): Promise<T> {
  let delay = 250
  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    try {
      return await fn()
    } catch (err: any) {
      if (err?.status === 429) {
        const retryAfter = parseInt(err?.headers?.["retry-after"] || "0", 10)
        const waitMs = retryAfter > 0 ? retryAfter * 1000 : delay
        await new Promise((r) => setTimeout(r, waitMs))
        delay = Math.min(delay * 2, 8000)
        continue
      }
      throw err
    }
  }
  throw new Error("Max retries exceeded for Notion request")
}

function extractRichTextEdges(
  rootPageId: string,
  richTextArr: any[],
  knownIds: Set<string>,
  knownNormalizedIds: Map<string, string>,
  rawEdges: RawEdge[]
) {
  for (const rt of richTextArr || []) {
    if (rt.type === "mention" && rt.mention?.type === "page") {
      const targetId = rt.mention.page.id as string
      if (knownIds.has(targetId) && targetId !== rootPageId) {
        rawEdges.push({
          source: rootPageId,
          target: targetId,
          type: "mention",
          context: rt.plain_text?.slice(0, CONTEXT_LIMIT),
        })
      }
    } else if (rt.type === "text" && rt.text?.link?.url) {
      const url = rt.text.link.url as string
      // Match trailing notion UUID (32 hex chars or hyphenated 36-char form)
      const match = url.match(/([0-9a-f]{32}|[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})\s*$/)
      if (match) {
        const normalized = match[1].replace(/-/g, "")
        const targetId = knownNormalizedIds.get(normalized)
        if (targetId && targetId !== rootPageId) {
          rawEdges.push({
            source: rootPageId,
            target: targetId,
            type: "link",
            context: rt.plain_text?.slice(0, CONTEXT_LIMIT),
          })
        }
      }
    }
  }
}

function getRichTextFromBlock(block: any): any[] {
  const type = block.type as string
  return block[type]?.rich_text || []
}

type ReadTimeAccumulator = {
  text: string
  imageCount: number
  codeLines: number
  otherSec: number
}

const TEXT_BLOCK_TYPES = new Set([
  "paragraph", "heading_1", "heading_2", "heading_3",
  "bulleted_list_item", "numbered_list_item", "to_do",
  "toggle", "quote", "callout",
])

function accumulateBlock(block: any, acc: ReadTimeAccumulator): void {
  const type = block.type as string

  if (TEXT_BLOCK_TYPES.has(type)) {
    for (const rt of (block[type]?.rich_text || []) as any[]) {
      acc.text += rt.plain_text ?? ""
    }
  } else if (type === "code") {
    const codeText = ((block.code?.rich_text || []) as any[])
      .map((rt: any) => rt.plain_text ?? "")
      .join("")
    acc.codeLines += (codeText.match(/\n/g)?.length ?? 0) + 1
  } else if (type === "image") {
    acc.imageCount += 1
    for (const rt of (block.image?.caption || []) as any[]) {
      acc.text += rt.plain_text ?? ""
    }
  } else if (type === "video" || type === "file" || type === "pdf" || type === "embed") {
    acc.otherSec += 30
  } else if (type === "bookmark" || type === "link_preview") {
    acc.otherSec += 5
  } else if (type === "equation") {
    acc.otherSec += 10
  } else if (type === "table_row") {
    acc.otherSec += ((block.table_row?.cells || []) as any[][]).length * 1.5
  }
}

async function walkBlocks(
  notion: ReturnType<typeof getOfficialNotionClient>,
  rootPageId: string,
  currentId: string,
  depth: number,
  visited: Set<string>,
  rawEdges: RawEdge[],
  knownIds: Set<string>,
  knownNormalizedIds: Map<string, string>,
  acc: ReadTimeAccumulator
): Promise<void> {
  if (depth > MAX_DEPTH || visited.has(currentId)) return
  visited.add(currentId)

  let cursor: string | undefined = undefined
  do {
    const res = await notionRequest(() =>
      notion.blocks.children.list({
        block_id: currentId,
        start_cursor: cursor,
        page_size: 100,
      })
    )

    for (const block of res.results as any[]) {
      const rt = getRichTextFromBlock(block)
      extractRichTextEdges(rootPageId, rt, knownIds, knownNormalizedIds, rawEdges)
      accumulateBlock(block, acc)

      if (block.type === "link_to_page") {
        const lt = block.link_to_page
        if (lt?.type === "page_id" && knownIds.has(lt.page_id) && lt.page_id !== rootPageId) {
          rawEdges.push({ source: rootPageId, target: lt.page_id, type: "link_to_page" })
        }
      }

      if (block.has_children) {
        await walkBlocks(
          notion,
          rootPageId,
          block.id,
          depth + 1,
          visited,
          rawEdges,
          knownIds,
          knownNormalizedIds,
          acc
        )
      }
    }

    cursor = res.has_more ? (res.next_cursor ?? undefined) : undefined
  } while (cursor)
}

export function normalizeHubId(prefix: string, name: string): string {
  return `${prefix}:${name.trim().toLowerCase()}`
}

export function buildPropertyEdges(posts: TPost[]): {
  hubNodes: (TagNode | SeriesNode)[]
  propertyEdges: NotionGraphEdge[]
} {
  const hubNodes: (TagNode | SeriesNode)[] = []
  const propertyEdges: NotionGraphEdge[] = []

  // tag hub 노드 + has-tag 엣지
  const tagMap = new Map<string, string>() // normalized id → display name
  for (const p of posts) {
    for (const t of p.tags ?? []) {
      const id = normalizeHubId("tag", t)
      if (!tagMap.has(id)) tagMap.set(id, t)
    }
  }
  for (const [id, title] of tagMap) {
    hubNodes.push({ kind: "tag", id, title })
  }
  for (const p of posts) {
    for (const t of p.tags ?? []) {
      const tagId = normalizeHubId("tag", t)
      propertyEdges.push({ source: p.id, target: tagId, type: "has-tag", weight: 1 })
    }
  }

  // series hub 노드 + in-series 엣지 + series-next (시간순 인접)
  const bySeries = new Map<string, TPost[]>()
  for (const p of posts) {
    const s = p.series?.[0]
    if (!s) continue
    if (!bySeries.has(s)) bySeries.set(s, [])
    bySeries.get(s)!.push(p)
  }
  for (const [seriesName, list] of bySeries) {
    const seriesId = normalizeHubId("series", seriesName)
    hubNodes.push({ kind: "series", id: seriesId, title: seriesName })
    for (const p of list) {
      propertyEdges.push({ source: p.id, target: seriesId, type: "in-series", weight: 1 })
    }
    const sorted = [...list].sort((a, b) => {
      const da = a.date?.start_date ?? a.createdTime ?? ""
      const db = b.date?.start_date ?? b.createdTime ?? ""
      return da.localeCompare(db)
    })
    for (let i = 0; i + 1 < sorted.length; i++) {
      propertyEdges.push({ source: sorted[i].id, target: sorted[i + 1].id, type: "series-next", weight: 1 })
    }
  }

  return { hubNodes, propertyEdges }
}

function dedupeAndWeight(rawEdges: RawEdge[]): NotionGraphEdge[] {
  const map = new Map<string, NotionGraphEdge>()
  for (const re of rawEdges) {
    const key = `${re.source}|${re.target}|${re.type}`
    const existing = map.get(key)
    if (existing) {
      existing.weight += 1
      if (re.context && (existing.contexts?.length ?? 0) < MAX_CONTEXTS) {
        existing.contexts = [...(existing.contexts ?? []), re.context]
      }
    } else {
      map.set(key, {
        source: re.source,
        target: re.target,
        type: re.type,
        weight: 1,
        ...(re.context ? { contexts: [re.context] } : {}),
      })
    }
  }
  return Array.from(map.values())
}

export async function buildNotionGraph(): Promise<NotionGraph> {
  const notion = getOfficialNotionClient()
  const posts = await getPosts()

  const knownIds = new Set(posts.map((p) => p.id))
  // Normalized (no hyphens) → original ID lookup for URL matching
  const knownNormalizedIds = new Map(
    posts.map((p) => [p.id.replace(/-/g, ""), p.id])
  )

  const rawEdges: RawEdge[] = []
  const readTimes = new Map<string, number>()
  const buildStart = Date.now()
  let timedOut = false

  function inChunks<T>(arr: T[], size: number): T[][] {
    const result: T[][] = []
    for (let i = 0; i < arr.length; i += size) result.push(arr.slice(i, i + size))
    return result
  }

  outer: for (const batch of inChunks(posts, CONCURRENCY)) {
    if (Date.now() - buildStart >= GRAPH_BUILD_TIMEOUT_MS) {
      timedOut = true
      warnLog(`[buildNotionGraph] timeout — returning partial graph (${rawEdges.length} raw edges collected)`)
      break outer
    }
    await Promise.all(
      batch.map(async (post) => {
        if (Date.now() - buildStart >= GRAPH_BUILD_TIMEOUT_MS) return
        debugLog(`[buildNotionGraph] walking blocks for "${post.slug}"`)
        const visited = new Set<string>()
        const acc: ReadTimeAccumulator = { text: "", imageCount: 0, codeLines: 0, otherSec: 0 }
        try {
          await walkBlocks(
            notion,
            post.id,
            post.id,
            0,
            visited,
            rawEdges,
            knownIds,
            knownNormalizedIds,
            acc
          )
        } catch (err) {
          warnLog(`[buildNotionGraph] skipping "${post.slug}" due to error:`, err)
        }
        readTimes.set(
          post.id,
          computeReadTime({ ...acc, typeWeight: readTimeTypeWeight(post.type) })
        )
      })
    )
  }

  const postNodes: NotionGraphNode[] = posts.map((p) => ({
    kind: "post",
    id: p.id,
    slug: p.slug,
    title: p.title,
    category: p.category?.[0] ?? "misc",
    tags: p.tags ?? [],
    readTime: readTimes.get(p.id) ?? 1,
    url: `${CONFIG.link}/${p.slug}`,
    createdAt: p.createdTime,
  }))

  const { hubNodes, propertyEdges } = buildPropertyEdges(posts)
  const nodes: NotionGraphNode[] = [...postNodes, ...hubNodes]

  const edges = [
    ...dedupeAndWeight(rawEdges),
    ...propertyEdges,
  ]
  debugLog(`[buildNotionGraph] done: ${nodes.length} nodes, ${edges.length} edges`)

  return {
    version: "v2",
    generatedAt: new Date().toISOString(),
    nodes,
    edges,
    ...(timedOut ? { partial: true } : {}),
  }
}
