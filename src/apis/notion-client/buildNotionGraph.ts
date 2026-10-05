import { getOfficialNotionClient } from "./notionClient"
import { getPosts } from "./getPosts"
import { NotionGraph, NotionGraphEdge, NotionGraphNode, RawEdge, SeriesNode, TagNode } from "src/types/notionGraph"
import { TPost } from "src/types"
import { CONFIG } from "site.config"
import { debugLog, warnLog } from "src/libs/utils/logger"
import { computeReadTime, readTimeTypeWeight } from "src/libs/utils/readTime"
import { z } from "zod"
import { cacheStore, keys } from "src/libs/cache"
import { eligibleGraphPosts, postContentVersion } from "./graphHash"
import type { Client } from "@notionhq/client"

const MAX_DEPTH = 2
const MAX_RETRIES = 5
const MAX_CONTEXTS = 3
const CONTEXT_LIMIT = 120
const CONCURRENCY = 4
const DEFAULT_GRAPH_BUILD_TIMEOUT_MS = 120_000
const MAX_GRAPH_BUILD_TIMEOUT_MS = 300_000
const configuredGraphBuildTimeoutMs = Number(process.env.GRAPH_BUILD_TIMEOUT_MS)
const GRAPH_BUILD_TIMEOUT_MS =
  Number.isFinite(configuredGraphBuildTimeoutMs) && configuredGraphBuildTimeoutMs > 0
    ? Math.min(Math.floor(configuredGraphBuildTimeoutMs), MAX_GRAPH_BUILD_TIMEOUT_MS)
    : DEFAULT_GRAPH_BUILD_TIMEOUT_MS

async function notionRequest<T>(fn: () => Promise<T>): Promise<T> {
  let delay = 250
  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    try {
      return await fn()
    } catch (err: unknown) {
      const rateLimit = z.object({ status: z.literal(429), headers: z.unknown().optional() }).safeParse(err)
      if (rateLimit.success) {
        const headers = rateLimit.data.headers
        const retryHeader = headers instanceof Headers
          ? headers.get("retry-after")
          : z.object({ "retry-after": z.string() }).safeParse(headers).data?.["retry-after"]
        const retryAfter = parseInt(retryHeader || "0", 10)
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

const richTextSchema = z.object({
  type: z.string(), plain_text: z.string().optional(),
  mention: z.object({ type: z.string(), page: z.object({ id: z.string() }).optional() }).optional(),
  text: z.object({ link: z.object({ url: z.string() }).nullable().optional() }).optional(),
})
const blockSchema = z.object({ id: z.string(), type: z.string(), has_children: z.boolean().optional() }).catchall(z.unknown())
const blockContentSchema = z.object({
  rich_text: z.array(richTextSchema).optional(), caption: z.array(richTextSchema).optional(),
  type: z.string().optional(), page_id: z.string().optional(), cells: z.array(z.array(z.unknown())).optional(),
})

type ReadTimeAccumulator = { text: string; imageCount: number; codeLines: number; otherSec: number }
export type PostGraphExtraction = { references: RawEdge[]; readTime: ReadTimeAccumulator; text: string }
const TEXT_BLOCK_TYPES: Record<string, boolean> = {
  paragraph: true, heading_1: true, heading_2: true, heading_3: true,
  bulleted_list_item: true, numbered_list_item: true, to_do: true,
  toggle: true, quote: true, callout: true,
}
const EXTRACTION_TTL_MS = 30 * 24 * 60 * 60 * 1000
const extractionsInFlight = new Map<string, Promise<PostGraphExtraction>>()

async function walkBlocks(
  notion: Client, rootPageId: string,
  currentId: string, depth: number, visited: Set<string>, extraction: PostGraphExtraction,
  textParts: string[], deadline: number
): Promise<void> {
  if (depth > MAX_DEPTH || visited.has(currentId)) return
  visited.add(currentId)
  let cursor: string | undefined
  do {
    if (Date.now() >= deadline) throw new Error("Graph extraction timed out")
    const res = await notionRequest(() => notion.blocks.children.list({
      block_id: currentId, start_cursor: cursor, page_size: 100,
    }))
    for (const rawBlock of res.results) {
      const block = blockSchema.parse(rawBlock)
      const content = blockContentSchema.parse(block[block.type] ?? {})
      const richText = content.rich_text ?? []
      // Keep references to non-public/unknown pages too. Membership is resolved at graph assembly.
      for (const rt of richText) {
        if (rt.type === "mention" && rt.mention?.type === "page" && rt.mention.page) {
          extraction.references.push({ source: rootPageId, target: rt.mention.page.id, type: "mention", context: rt.plain_text?.slice(0, CONTEXT_LIMIT) })
        } else if (rt.type === "text" && rt.text?.link?.url) {
          const match = rt.text.link.url.match(/([0-9a-f]{32}|[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})\s*$/i)
          if (match) extraction.references.push({ source: rootPageId, target: match[1], type: "link", context: rt.plain_text?.slice(0, CONTEXT_LIMIT) })
        }
      }
      const acc = extraction.readTime
      if (TEXT_BLOCK_TYPES[block.type]) {
        for (const rt of richText) { acc.text += rt.plain_text ?? ""; if (rt.plain_text) textParts.push(rt.plain_text) }
      } else if (block.type === "code") {
        const code = richText.map((rt) => rt.plain_text ?? "").join("")
        acc.codeLines += (code.match(/\n/g)?.length ?? 0) + 1
        if (code) textParts.push(code)
      } else if (block.type === "image") {
        acc.imageCount += 1
        for (const rt of content.caption ?? []) acc.text += rt.plain_text ?? ""
      } else if (["video", "file", "pdf", "embed"].includes(block.type)) acc.otherSec += 30
      else if (["bookmark", "link_preview"].includes(block.type)) acc.otherSec += 5
      else if (block.type === "equation") acc.otherSec += 10
      else if (block.type === "table_row") acc.otherSec += (content.cells?.length ?? 0) * 1.5
      if (block.type === "link_to_page" && content.type === "page_id" && content.page_id) {
        extraction.references.push({ source: rootPageId, target: content.page_id, type: "link_to_page" })
      }
      if (block.has_children) await walkBlocks(notion, rootPageId, block.id, depth + 1, visited, extraction, textParts, deadline)
    }
    cursor = res.has_more ? (res.next_cursor ?? undefined) : undefined
  } while (cursor)
}

export async function getPostGraphExtraction(post: TPost): Promise<PostGraphExtraction> {
  const key = keys.postGraphExtraction(post.id, postContentVersion(post))
  const pending = extractionsInFlight.get(key)
  if (pending) return pending
  const work = (async () => {
    const cached = await cacheStore.get<PostGraphExtraction>(key)
    if (cached) return cached
    debugLog(`[buildNotionGraph] walking blocks for "${post.slug}"`)
    const extraction: PostGraphExtraction = { references: [], readTime: { text: "", imageCount: 0, codeLines: 0, otherSec: 0 }, text: "" }
    const textParts: string[] = []
    await walkBlocks(getOfficialNotionClient(), post.id, post.id, 0, new Set(), extraction, textParts, Date.now() + GRAPH_BUILD_TIMEOUT_MS)
    extraction.text = textParts.join(" ").trim()
    await cacheStore.set(key, extraction, EXTRACTION_TTL_MS)
    return extraction
  })()
  extractionsInFlight.set(key, work)
  try { return await work } finally { extractionsInFlight.delete(key) }
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
  const bySeries = new Map<
    string,
    {
      title: string
      posts: TPost[]
    }
  >()
  for (const p of posts) {
    const rawSeries = p.series?.[0]
    if (!rawSeries) continue
    const normalizedSeries = rawSeries.trim()
    if (!normalizedSeries) continue
    const seriesId = normalizeHubId("series", normalizedSeries)
    const bucket = bySeries.get(seriesId)
    if (!bucket) {
      bySeries.set(seriesId, {
        title: normalizedSeries,
        posts: [p],
      })
    } else {
      bucket.posts.push(p)
    }
  }
  for (const [seriesId, { title, posts: seriesPosts }] of bySeries) {
    hubNodes.push({ kind: "series", id: seriesId, title })
    for (const p of seriesPosts) {
      propertyEdges.push({ source: p.id, target: seriesId, type: "in-series", weight: 1 })
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

export async function buildNotionGraph(inputPosts?: TPost[]): Promise<NotionGraph> {
  const posts = eligibleGraphPosts(inputPosts ?? await getPosts())
  const knownNormalizedIds = new Map(posts.map((p) => [p.id.replace(/-/g, "").toLowerCase(), p.id]))
  const rawEdges: RawEdge[] = []
  const readTimes = new Map<string, number>()
  const buildStart = Date.now()
  let partial = false
  for (let i = 0; i < posts.length; i += CONCURRENCY) {
    if (Date.now() - buildStart >= GRAPH_BUILD_TIMEOUT_MS) { partial = true; break }
    await Promise.all(posts.slice(i, i + CONCURRENCY).map(async (post) => {
      try {
        const extraction = await getPostGraphExtraction(post)
        for (const reference of extraction.references) {
          const target = knownNormalizedIds.get(reference.target.replace(/-/g, "").toLowerCase())
          if (target && target !== post.id) rawEdges.push({ ...reference, target })
        }
        readTimes.set(post.id, computeReadTime({ ...extraction.readTime, typeWeight: readTimeTypeWeight(post.type) }))
      } catch (err) {
        partial = true
        warnLog(`[buildNotionGraph] extraction failed for "${post.slug}":`, err)
      }
    }))
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
    ...(partial ? { partial: true } : {}),
  }
}
