import { QdrantClient } from "@qdrant/js-client-rest"
import { EMBEDDING_DIMS } from "src/apis/llm/openaiEmbedding"
import type { TPost } from "src/types"
import { getPosts } from "src/apis/notion-client/getPosts"
import { eligibleGraphPosts } from "src/apis/notion-client/graphHash"
import { z } from "zod"

export function normalizeUUID(id: string): string {
  const clean = id.replace(/-/g, "")
  if (clean.length === 32) {
    return `${clean.slice(0, 8)}-${clean.slice(8, 12)}-${clean.slice(12, 16)}-${clean.slice(16, 20)}-${clean.slice(20)}`
  }
  return id
}

const COLLECTION = "posts"

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
}

const postPayloadSchema = z.object({
  postId: z.string(), title: z.string(), slug: z.string(), category: z.string(),
  tags: z.array(z.string()), createdAt: z.string(),
})

export async function updatePostPayload(post: TPost): Promise<void> {
  await getQdrantClient().setPayload(COLLECTION, {
    wait: true, points: [normalizeUUID(post.id)],
    payload: { postId: post.id, title: post.title, slug: post.slug, category: post.category?.[0] ?? "misc", tags: post.tags ?? [], createdAt: post.createdTime },
  })
}

export async function ensureCollection(): Promise<void> {
  const client = getQdrantClient()
  const { collections } = await client.getCollections()
  if (collections.some((c) => c.name === COLLECTION)) return

  await client.createCollection(COLLECTION, {
    vectors: { size: EMBEDDING_DIMS, distance: "Cosine" },
  })
}

export async function upsertEmbedding(
  postId: string,
  vector: number[],
  payload: PostPayload
): Promise<void> {
  const client = getQdrantClient()
  await client.upsert(COLLECTION, {
    wait: true,
    points: [{ id: postId, vector, payload }],
  })
}

export type SimilarResult = {
  postId: string
  score: number
  payload: PostPayload
}

export async function deletePoint(postId: string): Promise<void> {
  const client = getQdrantClient()
  await client.delete(COLLECTION, { wait: true, points: [normalizeUUID(postId)] })
}

export async function searchSimilar(
  vector: number[],
  topK: number,
  excludeId?: string
): Promise<SimilarResult[]> {
  const posts = eligibleGraphPosts(await getPosts())
  const eligibleIds = new Set(posts.map((post) => post.id))
  if (!posts.length) return []
  const client = getQdrantClient()
  const results = await client.search(COLLECTION, {
    vector, limit: topK + (excludeId ? 1 : 0), with_payload: true,
    filter: { must: [{ has_id: posts.map((post) => normalizeUUID(post.id)) }] },
  })
  return results.flatMap((result) => {
    const parsed = postPayloadSchema.safeParse(result.payload)
    if (result.id === excludeId || !parsed.success || !eligibleIds.has(parsed.data.postId)) return []
    return [{ postId: parsed.data.postId, score: result.score, payload: parsed.data }]
  }).slice(0, topK)
}
