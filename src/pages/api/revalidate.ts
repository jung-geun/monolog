import { NextApiRequest, NextApiResponse } from "next"
import { getPosts } from "../../apis"
import { TPost } from "../../types"
import { cacheStore } from "src/libs/cache"
import { verifyRevalidateToken } from "src/libs/utils/auth/verifyToken"

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
      const revalidateRequests = [
        res.revalidate('/'),
        ...posts.map((row: TPost) => res.revalidate(`/${row.slug}`)),
      ]
      await Promise.all(revalidateRequests)
      // Attempt to warm the sitemap CDN cache by requesting /sitemap.xml from
      // the current host. This ensures the sitemap is refreshed in front of
      // any CDN/edge caches after we've revalidated pages.
      try {
        const host = req.headers.host
        const proto = (req.headers['x-forwarded-proto'] as string) || 'https'
        const sitemapUrl = `${proto}://${host}/sitemap.xml`
        // Use fetch to request sitemap so CDN (or reverse proxy) will update its cache
        await fetch(sitemapUrl)
      } catch (sitemapErr) {
        console.error('Failed to warm sitemap cache:', sitemapErr)
      }
    }

    res.json({ revalidated: true })
  } catch (err) {
    return res.status(500).send("Error revalidating")
  }
}
