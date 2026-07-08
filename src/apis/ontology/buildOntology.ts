import { createHash } from "crypto"
import { getPosts } from "src/apis/notion-client/getPosts"
import { extractPostOntology } from "./extractPostOntology"
import { extractRelations } from "./extractRelations"
import { searchSimilar, normalizeUUID } from "src/apis/vector/qdrantClient"
import { cacheStore, keys } from "src/libs/cache"
import { Ontology, Entity, PostOntology, SemanticEdge } from "src/types/ontology"
import { TPost } from "src/types"
import { debugLog, warnLog } from "src/libs/utils/logger"

const SIMILARITY_THRESHOLD = 0.85
const TOP_K = 8

function computePostsHash(posts: { id: string; lastEditedTime?: string; createdTime: string }[]): string {
  const sig = posts.map((p) => `${p.id}:${p.lastEditedTime ?? p.createdTime}`).sort().join("|")
  return createHash("sha1").update(sig).digest("hex").slice(0, 16)
}

function normalizeEntityName(name: string): string {
  return name.trim().toLowerCase()
}

function mergeEntities(postOntologies: Map<string, PostOntology>): Entity[] {
  const entityMap = new Map<string, Entity>()

  for (const [postId, ont] of postOntologies) {
    for (const raw of ont.entities) {
      const norm = normalizeEntityName(raw.name)
      const id = createHash("sha1").update(`entity:${norm}`).digest("hex").slice(0, 16)

      const existing = entityMap.get(id)
      if (existing) {
        if (!existing.postIds.includes(postId)) existing.postIds.push(postId)
        for (const alias of raw.aliases ?? []) {
          if (!existing.aliases.includes(alias)) existing.aliases.push(alias)
        }
      } else {
        entityMap.set(id, {
          id,
          kind: raw.kind,
          name: raw.name,
          aliases: raw.aliases ?? [],
          description: raw.description,
          postIds: [postId],
        })
      }
    }
  }

  return Array.from(entityMap.values())
}

export async function buildOntology(options?: { bypassCache?: boolean }): Promise<Ontology> {
  const posts = await getPosts()
  debugLog(`[buildOntology] processing ${posts.length} posts`)

  const postMap = new Map<string, TPost>(posts.map((p) => [p.id, p]))
  const postOntologies = new Map<string, PostOntology>()
  const summaries = new Map<string, string>()

  // Pass 1: entity extraction + embedding per post (concurrent in batches of 4)
  const CONCURRENCY = 4
  for (let i = 0; i < posts.length; i += CONCURRENCY) {
    const batch = posts.slice(i, i + CONCURRENCY)
    await Promise.all(
      batch.map(async (post) => {
        try {
          const ont = await extractPostOntology(post, options)
          postOntologies.set(post.id, ont)
          summaries.set(post.id, ont.summary)
        } catch (err) {
          warnLog(`[buildOntology] extractPostOntology failed for "${post.slug}":`, err)
        }
      })
    )
  }

  // Pass 2: vector similarity search → candidate pairs
  const candidatePairs = new Map<string, TPost[]>()
  const similarEdges: SemanticEdge[] = []

  for (const post of posts) {
    const lastEdited = post.lastEditedTime ?? post.createdTime
    const embKey = keys.embedding(post.id, lastEdited)
    const vector = await cacheStore.get<number[]>(embKey)
    if (!vector) continue

    let similar
    try {
      similar = await searchSimilar(vector, TOP_K, normalizeUUID(post.id))
    } catch (err) {
      warnLog(`[buildOntology] Qdrant search failed for "${post.slug}":`, err)
      continue
    }

    const candidates: TPost[] = []
    for (const result of similar) {
      const targetPost = postMap.get(result.payload.postId)
      if (!targetPost) continue
      candidates.push(targetPost)
      if (result.score >= SIMILARITY_THRESHOLD) {
        similarEdges.push({
          source: post.id,
          target: result.payload.postId,
          kind: "similar-topic",
          confidence: result.score,
        })
      }
    }
    candidatePairs.set(post.id, candidates)
  }

  // Pass 2 LLM: logical relation classification for top-K candidates
  const semanticEdges: SemanticEdge[] = [...similarEdges]
  for (const post of posts) {
    const candidates = candidatePairs.get(post.id) ?? []
    if (candidates.length === 0) continue
    try {
      const edges = await extractRelations(post, candidates, summaries, options)
      semanticEdges.push(...edges)
    } catch (err) {
      warnLog(`[buildOntology] extractRelations failed for "${post.slug}":`, err)
    }
  }

  const entities = mergeEntities(postOntologies)
  debugLog(`[buildOntology] done: ${entities.length} entities, ${semanticEdges.length} semantic edges`)

  return {
    version: "v1",
    generatedAt: new Date().toISOString(),
    entities,
    edges: semanticEdges,
  }
}
