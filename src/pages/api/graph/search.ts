import type { NextApiRequest, NextApiResponse } from "next"
import { embedQuery, isEmbeddingConfigured } from "src/apis/llm/embeddingGemma"
import { searchSimilar } from "src/apis/vector/qdrantClient"
import { LRUCache } from "lru-cache"
import { getIp } from "src/libs/utils/security"

const searchWindows = new LRUCache<string, { start: number; count: number }>({ max: 10_000, ttl: 60_000 })
let searchActive = false

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  res.setHeader("Cache-Control", "no-store")
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET")
    return res.status(405).end()
  }
  const query = typeof req.query.q === "string" ? req.query.q.trim() : ""
  if (!query || query.length > 8000) return res.status(400).json({ error: "q must contain 1–8000 characters" })
  if (!isEmbeddingConfigured()) {
    return res.status(503).json({ error: "Semantic search is not configured" })
  }
  const now = Date.now()
  const ip = getIp(req)
  const window = searchWindows.get(ip)
  if (window && now - window.start < 60_000 && window.count >= 6) {
    res.setHeader("Retry-After", Math.ceil((60_000 - (now - window.start)) / 1000))
    return res.status(429).json({ error: "Semantic search rate limit exceeded" })
  }
  if (searchActive) {
    res.setHeader("Retry-After", "1")
    return res.status(429).json({ error: "Semantic search is busy" })
  }
  searchWindows.set(ip, window && now - window.start < 60_000
    ? { start: window.start, count: window.count + 1 }
    : { start: now, count: 1 })
  searchActive = true
  try {
    const vector = await embedQuery(query)
    const similar = await searchSimilar(vector, 10)
    return res.json({ results: similar.map(result => ({
      postId: result.postId, slug: result.payload.slug, title: result.payload.title,
      category: result.payload.category, score: result.score,
    })) })
  } catch (error) {
    console.error("[graph/search]", error)
    return res.status(503).json({ error: "Semantic search is temporarily unavailable" })
  } finally {
    searchActive = false
  }
}
