import { NextApiRequest, NextApiResponse } from "next"
import { getPosts } from "../../apis"
import { TPost } from "../../types"
import { cacheStore } from "src/libs/cache"
import { verifyRevalidateToken } from "src/libs/utils/auth/verifyToken"
import { getNotionGraph } from "src/apis/notion-client/getNotionGraph"

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (!verifyRevalidateToken(req)) {
    return res.status(401).json({ message: "Invalid token" })
  }
  const { path } = req.query

  try {
    if (path && typeof path === "string") {
      await res.revalidate(path)
    } else {
      await cacheStore.clear()
      const posts = await getPosts({ bypassCache: true })
      await getNotionGraph({ bypassCache: true })
      const revalidateRequests = [
        res.revalidate('/'),
        res.revalidate('/graph'),
        ...posts.map((row: TPost) => res.revalidate(`/${row.slug}`)),
      ]
      await Promise.all(revalidateRequests)

      const host = req.headers.host
      const proto = (req.headers['x-forwarded-proto'] as string) || 'https'
      try {
        await fetch(`${proto}://${host}/sitemap.xml`)
      } catch (sitemapErr) {
        console.error('Failed to warm sitemap cache:', sitemapErr)
      }
      try {
        await fetch(`${proto}://${host}/graphs/notion-graph.json`)
      } catch (graphErr) {
        console.error('Failed to warm notion-graph cache:', graphErr)
      }
    }

    res.json({ revalidated: true })
  } catch (err) {
    return res.status(500).send("Error revalidating")
  }
}
