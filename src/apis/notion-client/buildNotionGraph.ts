import { getOfficialNotionClient } from "./notionClient"
import { getPosts } from "./getPosts"
import { NotionGraph, NotionGraphEdge, NotionGraphNode, RawEdge } from "src/types/notionGraph"
import { TPost } from "src/types"
import { CONFIG } from "site.config"
import { debugLog, warnLog } from "src/libs/utils/logger"

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

async function walkBlocks(
  notion: ReturnType<typeof getOfficialNotionClient>,
  rootPageId: string,
  currentId: string,
  depth: number,
  visited: Set<string>,
  rawEdges: RawEdge[],
  knownIds: Set<string>,
  knownNormalizedIds: Map<string, string>
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
          knownNormalizedIds
        )
      }
    }

    cursor = res.has_more ? (res.next_cursor ?? undefined) : undefined
  } while (cursor)
}

const SHARED_TAG_MAX_PAGES = 8

function buildPropertyEdges(posts: TPost[]): NotionGraphEdge[] {
  const propertyEdges: NotionGraphEdge[] = []

  // shared-tag: 같은 태그를 공유하는 페이지 쌍
  const byTag = new Map<string, string[]>()
  for (const p of posts) {
    for (const t of p.tags ?? []) {
      if (!byTag.has(t)) byTag.set(t, [])
      byTag.get(t)!.push(p.id)
    }
  }
  const sharedTagWeight = new Map<string, number>()
  for (const ids of byTag.values()) {
    if (ids.length > SHARED_TAG_MAX_PAGES) continue
    for (let i = 0; i < ids.length; i++) {
      for (let j = i + 1; j < ids.length; j++) {
        const [a, b] = [ids[i], ids[j]].sort()
        const pairKey = `${a}|${b}`
        sharedTagWeight.set(pairKey, (sharedTagWeight.get(pairKey) ?? 0) + 1)
      }
    }
  }
  for (const [pairKey, w] of sharedTagWeight) {
    const [source, target] = pairKey.split("|")
    propertyEdges.push({ source, target, type: "shared-tag", weight: w })
  }

  // shared-series + series-next: 같은 시리즈 내 페이지
  const bySeries = new Map<string, TPost[]>()
  for (const p of posts) {
    const s = p.series?.[0]
    if (!s) continue
    if (!bySeries.has(s)) bySeries.set(s, [])
    bySeries.get(s)!.push(p)
  }
  for (const list of bySeries.values()) {
    if (list.length < 2) continue
    for (let i = 0; i < list.length; i++) {
      for (let j = i + 1; j < list.length; j++) {
        const [a, b] = [list[i].id, list[j].id].sort()
        propertyEdges.push({ source: a, target: b, type: "shared-series", weight: 1 })
      }
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

  return propertyEdges
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

  const nodes: NotionGraphNode[] = posts.map((p) => ({
    id: p.id,
    slug: p.slug,
    title: p.title,
    category: p.category?.[0] ?? "misc",
    tags: p.tags ?? [],
    url: `${CONFIG.link}/${p.slug}`,
  }))

  const rawEdges: RawEdge[] = []
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
        try {
          await walkBlocks(
            notion,
            post.id,
            post.id,
            0,
            visited,
            rawEdges,
            knownIds,
            knownNormalizedIds
          )
        } catch (err) {
          warnLog(`[buildNotionGraph] skipping "${post.slug}" due to error:`, err)
        }
      })
    )
  }

  const edges = [
    ...dedupeAndWeight(rawEdges),
    ...buildPropertyEdges(posts),
  ]
  debugLog(`[buildNotionGraph] done: ${nodes.length} nodes, ${edges.length} edges`)

  return {
    version: "v1",
    generatedAt: new Date().toISOString(),
    nodes,
    edges,
    ...(timedOut ? { partial: true } : {}),
  }
}
