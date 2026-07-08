import { callWithTool } from "src/apis/llm/anthropicClient"
import { cacheStore, keys } from "src/libs/cache"
import { TPost } from "src/types"
import { SemanticEdge, SemanticRelationKind } from "src/types/ontology"
import { warnLog } from "src/libs/utils/logger"

const RELATION_TTL_MS = 7 * 24 * 60 * 60 * 1000

const RELATION_SCHEMA = {
  type: "object",
  required: ["relations"],
  properties: {
    relations: {
      type: "array",
      items: {
        type: "object",
        required: ["kind", "confidence"],
        properties: {
          kind: {
            type: "string",
            enum: ["elaborates", "contradicts", "supports", "prerequisite", "applies", "none"],
          },
          confidence: { type: "number" },
          rationale: { type: "string" },
        },
      },
    },
  },
}

type LLMRelationItem = {
  kind: SemanticRelationKind | "none"
  confidence: number
  rationale?: string
}

type LLMRelationOutput = {
  relations: LLMRelationItem[]
}

export async function extractRelations(
  sourcePost: TPost,
  targetPosts: TPost[],
  summaries: Map<string, string>,
  { bypassCache = false }: { bypassCache?: boolean } = {}
): Promise<SemanticEdge[]> {
  if (targetPosts.length === 0) return []

  const sourceSummary = summaries.get(sourcePost.id) ?? sourcePost.title
  const results: SemanticEdge[] = []

  for (const target of targetPosts) {
    const sourceLastEdited = sourcePost.lastEditedTime ?? sourcePost.createdTime
    const targetLastEdited = target.lastEditedTime ?? target.createdTime
    const cacheKey = keys.ontology(`rel:${sourcePost.id}:${target.id}:${sourceLastEdited}:${targetLastEdited}`)

    if (!bypassCache) {
      const cached = await cacheStore.get<{ edge: SemanticEdge | null }>(cacheKey)
      if (cached !== null) {
        if (cached.edge !== null) results.push(cached.edge)
        continue
      }
    }

    const targetSummary = summaries.get(target.id) ?? target.title

    let llmResult: LLMRelationOutput
    try {
      llmResult = await callWithTool<LLMRelationOutput>({
        system:
          "당신은 두 블로그 포스트 사이의 논리적 관계를 분류하는 전문가입니다. elaborates(상세 설명), contradicts(반대), supports(보강), prerequisite(전제), applies(이론→적용), none(관계없음) 중 하나로 분류하세요.",
        userMessage: `포스트 A: "${sourcePost.title}"\n요약: ${sourceSummary}\n\n포스트 B: "${target.title}"\n요약: ${targetSummary}\n\nA→B 관계를 분류하세요. 관계가 있으면 한 줄 근거도 제시하세요.`,
        toolName: "classify_relation",
        toolDescription: "두 포스트 사이의 논리적 관계를 분류합니다",
        inputSchema: RELATION_SCHEMA,
        maxTokens: 256,
      })
    } catch (err) {
      warnLog(`[extractRelations] LLM failed for pair (${sourcePost.id}, ${target.id}):`, err)
      continue
    }

    const rel = llmResult.relations[0]
    if (!rel || rel.kind === "none" || rel.confidence < 0.6) {
      await cacheStore.set(cacheKey, { edge: null }, RELATION_TTL_MS)
      continue
    }

    const edge: SemanticEdge = {
      source: sourcePost.id,
      target: target.id,
      kind: rel.kind as SemanticRelationKind,
      confidence: rel.confidence,
      rationale: rel.rationale,
    }
    await cacheStore.set(cacheKey, { edge }, RELATION_TTL_MS)
    results.push(edge)
  }

  return results
}
