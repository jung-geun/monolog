import { NextApiRequest, NextApiResponse } from "next"
import { getPosts } from "../../apis"
import { TPost } from "../../types"
import { cacheStore } from "src/libs/cache"

// for all path revalidate, https://<your-site.com>/api/revalidate?secret=<token>
// for specific path revalidate, https://<your-site.com>/api/revalidate?secret=<token>&path=<path>
// example, https://<your-site.com>/api/revalidate?secret=이것은_키&path=feed
export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  const { secret, path } = req.query
  if (secret !== process.env.TOKEN_FOR_REVALIDATE) {
    return res.status(401).json({ message: "Invalid token" })
  }

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
