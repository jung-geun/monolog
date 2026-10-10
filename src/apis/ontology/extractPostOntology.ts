import { getPostGraphExtraction } from "src/apis/notion-client/buildNotionGraph"
import { callWithTool } from "src/apis/llm/anthropicClient"
import { cacheStore, keys } from "src/libs/cache"
import { TPost } from "src/types"
import { PostOntology, EntityKind } from "src/types/ontology"
import { debugLog } from "src/libs/utils/logger"
import { postContentVersion } from "src/apis/notion-client/graphHash"

const MIN_TEXT_LENGTH = 200
const POST_ONTOLOGY_TTL_MS = 7 * 24 * 60 * 60 * 1000


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
  const lastEdited = postContentVersion(post)
  const cacheKey = keys.postOntology(post.id, lastEdited)

  if (!bypassCache) {
    const cached = await cacheStore.get<PostOntology>(cacheKey)
    if (cached) return cached
  }

  const { text } = await getPostGraphExtraction(post)

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

  return result
}

