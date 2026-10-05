import type { NextApiRequest, NextApiResponse } from "next"
import { getPosts } from "src/apis/notion-client/getPosts"
import { filterPosts } from "src/libs/utils/notion/filterPosts"
import { FEED_POSTS_FILTER } from "src/libs/react-query/prefetchFeedPosts"

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  res.setHeader("Cache-Control", "no-store")
  if (req.method !== "GET" && req.method !== "HEAD") {
    res.setHeader("Allow", "GET, HEAD")
    return res.status(405).end()
  }
  try {
    const posts = filterPosts(await getPosts(), FEED_POSTS_FILTER)
    if (req.method === "HEAD") return res.status(200).end()
    return res.status(200).json(posts)
  } catch {
    return res.status(503).json({ error: "Publication metadata temporarily unavailable" })
  }
}
