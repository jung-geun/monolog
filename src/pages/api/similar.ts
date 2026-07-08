import { NextApiRequest, NextApiResponse } from "next"
import { getPosts } from "src/apis/notion-client/getPosts"
import { searchSimilar, normalizeUUID } from "src/apis/vector/qdrantClient"
import { cacheStore, keys } from "src/libs/cache"
import { getOntology } from "src/apis/ontology/getOntology"

export type SimilarPost = {
  postId: string
  slug: string
  title: string
  category: string
  score: number
  rationale?: string
}

// GET /api/similar?postId=<notionId>&limit=5
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "GET") return res.status(405).end()

  const rawId = typeof req.query.postId === "string" ? req.query.postId : undefined
  if (!rawId) return res.status(400).json({ error: "postId is required" })

  const limit = Math.min(Number(req.query.limit ?? 5), 20)

  // Look up the post to get lastEditedTime for the embedding cache key
  const posts = await getPosts()
  const post = posts.find((p) => p.id === rawId || p.slug === rawId)
  if (!post) return res.status(404).json({ error: "Post not found" })

  const lastEdited = post.lastEditedTime ?? post.createdTime
  const embKey = keys.embedding(post.id, lastEdited)
  const vector = await cacheStore.get<number[]>(embKey)

  if (!vector) {
    return res.status(202).json({
      ready: false,
      message: "Ontology not built yet. Trigger /api/cron/ontology to build.",
    })
  }

  const similar = await searchSimilar(vector, limit, normalizeUUID(post.id))

  // Enrich with rationale from ontology if available
  const ontology = await getOntology()
  const rationaleMap = new Map<string, string>()
  if (ontology) {
    for (const edge of ontology.edges) {
      if (edge.source === post.id && edge.rationale) {
        rationaleMap.set(edge.target, edge.rationale)
      }
    }
  }

  const results: SimilarPost[] = similar.map((r) => {
    return {
      postId: r.payload.postId,
      slug: r.payload.slug,
      title: r.payload.title,
      category: r.payload.category,
      score: r.score,
      rationale: rationaleMap.get(r.payload.postId),
    }
  })

  res.setHeader("Cache-Control", "public, s-maxage=3600, stale-while-revalidate=600")
  res.json({ postId: post.id, results })
}
