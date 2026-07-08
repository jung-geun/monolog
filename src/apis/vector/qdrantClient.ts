import { QdrantClient } from "@qdrant/js-client-rest"
import { EMBEDDING_DIMS } from "src/apis/llm/openaiEmbedding"

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
  const client = getQdrantClient()
  const results = await client.search(COLLECTION, {
    vector,
    limit: topK + (excludeId ? 1 : 0),
    with_payload: true,
  })
  return results
    .filter((r) => r.id !== excludeId)
    .slice(0, topK)
    .map((r) => ({
      postId: r.id as string,
      score: r.score,
      payload: r.payload as PostPayload,
    }))
}
