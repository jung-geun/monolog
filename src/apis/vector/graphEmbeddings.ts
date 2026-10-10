import type { BuiltGraph } from "src/apis/notion-client/getBuiltGraph"
import { eligibleGraphPosts } from "src/apis/notion-client/graphHash"
import { EMBEDDING_MODEL, isEmbeddingConfigured } from "src/apis/llm/embeddingGemma"
import type { GraphWithEmbeddings } from "src/types/graphEmbedding"
import type { TPost } from "src/types"
import { normalizeUUID, readPostEmbeddings } from "./qdrantClient"
import type { StoredPostEmbedding } from "./qdrantClient"
import { postEmbeddingVersion } from "./postEmbeddingVersion"
import { projectEmbeddings } from "./projectEmbeddings"

function nearestDocumentPairs(documents: { id: string; vector: number[] }[]) {
  const k = 3
  const indices = new Int32Array(documents.length * k).fill(-1)
  const scores = new Float64Array(documents.length * k).fill(-Infinity)
  const insert = (row: number, other: number, score: number) => {
    const start = row * k
    for (let rank = 0; rank < k; rank++) {
      if (score <= scores[start + rank]) continue
      for (let shift = k - 1; shift > rank; shift--) {
        scores[start + shift] = scores[start + shift - 1]
        indices[start + shift] = indices[start + shift - 1]
      }
      scores[start + rank] = score
      indices[start + rank] = other
      break
    }
  }
  for (let a = 0; a < documents.length; a++) {
    for (let b = a + 1; b < documents.length; b++) {
      let score = 0
      for (let d = 0; d < documents[a].vector.length; d++) score += documents[a].vector[d] * documents[b].vector[d]
      insert(a, b, score)
      insert(b, a, score)
    }
  }
  const seen = new Set<string>()
  const pairs: { source: string; target: string; score: number }[] = []
  for (let a = 0; a < documents.length; a++) {
    for (let rank = 0; rank < k; rank++) {
      const b = indices[a * k + rank]
      if (b < 0) continue
      const source = documents[Math.min(a, b)].id
      const target = documents[Math.max(a, b)].id
      const key = `${source}:${target}`
      if (seen.has(key)) continue
      seen.add(key)
      pairs.push({ source, target, score: Math.max(-1, Math.min(1, scores[a * k + rank])) })
    }
  }
  return pairs
}

export async function withPostEmbeddingPositions(graph: BuiltGraph, posts: TPost[]): Promise<GraphWithEmbeddings> {
  const current = new Map(eligibleGraphPosts(posts).map(post => [normalizeUUID(post.id), post]))
  const configured = isEmbeddingConfigured()
  let stored: Map<string, StoredPostEmbedding> = new Map()
  let available = true
  try {
    if (process.env.QDRANT_URL || configured) stored = await readPostEmbeddings()
  } catch (error) {
    console.warn("[graph/embeddings] Vector enrichment unavailable; preserving relationship graph", error)
    available = false
  }
  const documents = graph.nodes.flatMap(node => {
    if (node.kind !== "post") return []
    const post = current.get(normalizeUUID(node.id))
    const point = stored.get(normalizeUUID(node.id))
    return post && point?.vector && point.payload.documentHash === postEmbeddingVersion(post)
      ? [{ id: node.id, vector: point.vector }] : []
  }).sort((a, b) => a.id.localeCompare(b.id))
  const positions = projectEmbeddings(documents.map(document => document.vector))
  const byId = new Map(documents.map((document, index) => [document.id, positions[index]]))
  const total = graph.nodes.filter(node => node.kind === "post").length
  return {
    ...graph,
    nodes: graph.nodes.map(node => ({ ...node, ...(byId.has(node.id) ? { embeddingPosition: byId.get(node.id) } : {}) })),
    embedding: {
      model: EMBEDDING_MODEL, projection: "PCA-3D", embedded: documents.length,
      total,
      searchAvailable: configured && available,
      pending: configured && (!available || documents.length < total),
      similarities: nearestDocumentPairs(documents),
    },
  }
}
