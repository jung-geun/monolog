import { QdrantClient } from "@qdrant/js-client-rest"
import { EMBEDDING_DIMS, EMBEDDING_MODEL, EMBEDDING_REVISION, isEmbeddingConfigured } from "src/apis/llm/embeddingGemma"
import type { TPost } from "src/types"
import { getPosts } from "src/apis/notion-client/getPosts"
import { eligibleGraphPosts } from "src/apis/notion-client/graphHash"
import { postEmbeddingVersion } from "./postEmbeddingVersion"
import { z } from "zod"

export function normalizeUUID(id: string): string {
  const clean = id.replace(/-/g, "")
  if (clean.length === 32) {
    return `${clean.slice(0, 8)}-${clean.slice(8, 12)}-${clean.slice(12, 16)}-${clean.slice(16, 20)}-${clean.slice(20)}`
  }
  return id
}

// Never reinterpret the former 1536d OpenAI collection as Gemma vectors.
export const POST_EMBEDDING_COLLECTION = "post_embeddings_embeddinggemma_2_768_v1"
let _client: QdrantClient | null = null
export function getQdrantClient(): QdrantClient {
  if (!_client) {
    const url = process.env.QDRANT_URL ?? "http://localhost:6333"
    const apiKey = process.env.QDRANT_API_KEY || undefined
    _client = new QdrantClient({ url, apiKey })
  }
  return _client
}

export type PostPayload = {
  postId: string
  title: string
  slug: string
  category: string
  tags: string[]
  createdAt: string
  model: typeof EMBEDDING_MODEL
  revision: typeof EMBEDDING_REVISION
  documentHash: string
}
const postPayloadSchema = z.object({
  postId: z.string(), title: z.string(), slug: z.string(), category: z.string(),
  tags: z.array(z.string()), createdAt: z.string(),
  model: z.literal(EMBEDDING_MODEL), revision: z.literal(EMBEDDING_REVISION),
  documentHash: z.string(),
})
export function embeddingPayload(post: TPost): PostPayload {
  return {
    postId: post.id, title: post.title, slug: post.slug,
    category: post.category?.[0] ?? "misc", tags: post.tags ?? [], createdAt: post.createdTime,
    model: EMBEDDING_MODEL, revision: EMBEDDING_REVISION, documentHash: postEmbeddingVersion(post),
  }
}
const missingCollection = (error: unknown) =>
  !!error && typeof error === "object" && "status" in error && error.status === 404

export async function ensureCollection(): Promise<void> {
  const client = getQdrantClient()
  if (await client.collectionExists(POST_EMBEDDING_COLLECTION).then(result => result.exists)) return
  await client.createCollection(POST_EMBEDDING_COLLECTION, {
    vectors: { size: EMBEDDING_DIMS, distance: "Cosine" }, on_disk_payload: true,
  })
}
export type StoredPostEmbedding = { payload: PostPayload; vector?: number[] }
export async function readPostEmbeddings(withVectors = true): Promise<Map<string, StoredPostEmbedding>> {
  const result = new Map<string, StoredPostEmbedding>()
  const client = getQdrantClient()
  let offset: string | number | null | undefined
  try {
    do {
      const page = await client.scroll(POST_EMBEDDING_COLLECTION, {
        limit: 256, offset: offset ?? undefined, with_payload: true, with_vector: withVectors,
      })
      for (const point of page.points) {
        const payload = postPayloadSchema.safeParse(point.payload)
        if (!payload.success) continue
        const vector = Array.isArray(point.vector) ? point.vector as number[] : undefined
        if (withVectors && (!vector || vector.length !== EMBEDDING_DIMS || !vector.every(Number.isFinite))) continue
        result.set(normalizeUUID(payload.data.postId), { payload: payload.data, ...(withVectors ? { vector } : {}) })
      }
      offset = page.next_page_offset as string | number | null | undefined
    } while (offset !== null && offset !== undefined)
  } catch (error) { if (!missingCollection(error)) throw error }
  return result
}
export async function getPostEmbedding(post: TPost): Promise<number[] | null> {
  if (!process.env.QDRANT_URL && !isEmbeddingConfigured()) return null
  try {
    const points = await getQdrantClient().retrieve(POST_EMBEDDING_COLLECTION, {
      ids: [normalizeUUID(post.id)], with_payload: true, with_vector: true,
    })
    const point = points[0]
    const payload = postPayloadSchema.safeParse(point?.payload)
    const vector = point?.vector
    return payload.success && payload.data.documentHash === postEmbeddingVersion(post)
      && Array.isArray(vector) && vector.length === EMBEDDING_DIMS && vector.every(Number.isFinite)
      ? vector as number[] : null
  } catch (error) {
    if (missingCollection(error)) return null
    throw error
  }
}
export async function upsertEmbeddings(posts: TPost[], vectors: number[][]): Promise<void> {
  if (posts.length !== vectors.length || vectors.some(vector => vector.length !== EMBEDDING_DIMS || !vector.every(Number.isFinite))) {
    throw new Error("Invalid EmbeddingGemma batch")
  }
  await getQdrantClient().upsert(POST_EMBEDDING_COLLECTION, {
    wait: true, points: posts.map((post, index) => ({
      id: normalizeUUID(post.id), vector: vectors[index], payload: embeddingPayload(post),
    })),
  })
}
export async function updateEmbeddingMetadata(post: TPost): Promise<void> {
  await getQdrantClient().setPayload(POST_EMBEDDING_COLLECTION, {
    wait: true, points: [normalizeUUID(post.id)], payload: embeddingPayload(post),
  })
}
export async function deleteEmbeddings(ids: string[]): Promise<void> {
  if (!ids.length) return
  await getQdrantClient().delete(POST_EMBEDDING_COLLECTION, { wait: true, points: ids.map(normalizeUUID) })
}
export type SimilarResult = { postId: string; score: number; payload: PostPayload }
export async function searchSimilar(vector: number[], topK: number, excludeId?: string, candidateIds?: Readonly<Record<string, unknown>>): Promise<SimilarResult[]> {
  const posts = eligibleGraphPosts(await getPosts()).filter(post =>
    (!excludeId || normalizeUUID(post.id) !== normalizeUUID(excludeId))
      && (!candidateIds || Object.hasOwn(candidateIds, post.id)))
  if (!posts.length) return []
  const current = new Map(posts.map(post => [normalizeUUID(post.id), post]))
  try {
    const results = await getQdrantClient().search(POST_EMBEDDING_COLLECTION, {
      vector, limit: topK, with_payload: true,
      // Filter before ranking: withdrawn and outdated document versions must
      // never crowd current documents out of the nearest-neighbour results.
      filter: { should: posts.map(post => ({ must: [
        { has_id: [normalizeUUID(post.id)] },
        { key: "documentHash", match: { value: postEmbeddingVersion(post) } },
      ] })) },
    })
    return results.flatMap(result => {
      const parsed = postPayloadSchema.safeParse(result.payload)
      const post = current.get(normalizeUUID(String(result.id)))
      if (!post || !parsed.success || parsed.data.documentHash !== postEmbeddingVersion(post)) return []
      return [{ postId: post.id, score: result.score, payload: embeddingPayload(post) }]
    })
  } catch (error) {
    if (missingCollection(error)) return []
    throw error
  }
}
