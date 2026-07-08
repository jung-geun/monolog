import { getOfficialNotionClient } from "src/apis/notion-client/notionClient"
import { callWithTool } from "src/apis/llm/anthropicClient"
import { embedText } from "src/apis/llm/openaiEmbedding"
import { ensureCollection, upsertEmbedding, normalizeUUID } from "src/apis/vector/qdrantClient"
import { cacheStore, keys } from "src/libs/cache"
import { TPost } from "src/types"
import { PostOntology, EntityKind } from "src/types/ontology"
import { debugLog, warnLog } from "src/libs/utils/logger"

const MIN_TEXT_LENGTH = 200
const POST_ONTOLOGY_TTL_MS = 7 * 24 * 60 * 60 * 1000

const TEXT_BLOCK_TYPES = new Set([
  "paragraph", "heading_1", "heading_2", "heading_3",
  "bulleted_list_item", "numbered_list_item", "to_do",
  "toggle", "quote", "callout",
])

async function fetchPostText(pageId: string): Promise<string> {
  const notion = getOfficialNotionClient()
  const parts: string[] = []

  async function walk(blockId: string, depth: number): Promise<void> {
    if (depth > 2) return
    let cursor: string | undefined
    do {
      const res = await notion.blocks.children.list({
        block_id: blockId,
        start_cursor: cursor,
        page_size: 100,
      })
      for (const block of res.results as any[]) {
        const type = block.type as string
        if (TEXT_BLOCK_TYPES.has(type)) {
          for (const rt of (block[type]?.rich_text || []) as any[]) {
            if (rt.plain_text) parts.push(rt.plain_text)
          }
        } else if (type === "code") {
          for (const rt of (block.code?.rich_text || []) as any[]) {
            if (rt.plain_text) parts.push(rt.plain_text)
          }
        }
        if (block.has_children) await walk(block.id, depth + 1)
      }
      cursor = res.has_more ? (res.next_cursor ?? undefined) : undefined
    } while (cursor)
  }

  await walk(pageId, 0)
  return parts.join(" ").trim()
}

type LLMEntityOutput = {
  name: string
  kind: EntityKind
  aliases?: string[]
  description?: string
}

type LLMOntologyOutput = {
  summary: string
  entities: LLMEntityOutput[]
}

const EXTRACT_SCHEMA = {
  type: "object",
  required: ["summary", "entities"],
  properties: {
    summary: { type: "string", description: "Post 핵심 내용 요약 (한 문장, 150자 이내)" },
    entities: {
      type: "array",
      items: {
        type: "object",
        required: ["name", "kind"],
        properties: {
          name: { type: "string" },
          kind: { type: "string", enum: ["concept", "person", "tech", "work"] },
          aliases: { type: "array", items: { type: "string" } },
          description: { type: "string" },
        },
      },
    },
  },
}

async function callLLMExtract(post: TPost, text: string): Promise<LLMOntologyOutput> {
  const truncated = text.slice(0, 6000)
  return callWithTool<LLMOntologyOutput>({
    system:
      "당신은 블로그 포스트에서 핵심 개체와 요약을 추출하는 전문가입니다. 한국어 포스트를 포함합니다.",
    userMessage: `다음 블로그 포스트를 분석하세요.

제목: ${post.title}
카테고리: ${post.category?.[0] ?? "misc"}
태그: ${(post.tags ?? []).join(", ")}

본문:
${truncated}`,
    toolName: "extract_ontology",
    toolDescription: "포스트에서 핵심 개체와 요약을 추출합니다",
    inputSchema: EXTRACT_SCHEMA,
    maxTokens: 1024,
  })
}

export async function extractPostOntology(
  post: TPost,
  { bypassCache = false }: { bypassCache?: boolean } = {}
): Promise<PostOntology> {
  const lastEdited = post.lastEditedTime ?? post.createdTime
  const cacheKey = keys.postOntology(post.id, lastEdited)

  if (!bypassCache) {
    const cached = await cacheStore.get<PostOntology>(cacheKey)
    if (cached) return cached
  }

  let text: string
  try {
    text = await fetchPostText(post.id)
  } catch (err) {
    warnLog(`[extractPostOntology] failed to fetch text for "${post.slug}":`, err)
    text = post.title
  }

  if (text.length < MIN_TEXT_LENGTH) {
    debugLog(`[extractPostOntology] "${post.slug}" text too short (${text.length}), using title only`)
  }

  const llmResult = await callLLMExtract(post, text || post.title)

  const result: PostOntology = {
    postId: post.id,
    summary: llmResult.summary,
    entities: llmResult.entities.map((e) => ({
      kind: e.kind,
      name: e.name,
      aliases: e.aliases ?? [],
      description: e.description,
    })),
  }

  await cacheStore.set(cacheKey, result, POST_ONTOLOGY_TTL_MS)

  // embed + upsert Qdrant (fire-and-forget errors are non-fatal)
  try {
    await ensureCollection()
    const vector = await embedText(`${post.title}\n\n${llmResult.summary}\n\n${text.slice(0, 2000)}`)
    await upsertEmbedding(normalizeUUID(post.id), vector, {
      postId: post.id,
      title: post.title,
      slug: post.slug,
      category: post.category?.[0] ?? "misc",
      tags: post.tags ?? [],
      createdAt: post.createdTime,
    })
    // cache the vector for relation extraction
    const embKey = keys.embedding(post.id, lastEdited)
    await cacheStore.set(embKey, vector, POST_ONTOLOGY_TTL_MS)
  } catch (err) {
    warnLog(`[extractPostOntology] embedding/upsert failed for "${post.slug}":`, err)
  }

  return result
}

