import { NextApiRequest, NextApiResponse } from "next"
import { getPosts } from "../../apis"
import { verifyRevalidateToken } from "src/libs/utils/auth/verifyToken"
import { getInternalOrigin } from "src/libs/utils/security"

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (!verifyRevalidateToken(req)) {
    return res.status(401).json({ message: "Invalid token" })
  }

  console.log("🚀 Initializing ISR cache...")

  try {
    // 1. Warm Notion cache by fetching all posts
    const posts = await getPosts()
    console.log(`📦 Fetched ${posts.length} posts from Notion`)

    // 2. Revalidate routes serially. Each post render reads Notion; concurrent
    // revalidation can exceed Notion's request rate and leave a partial cold cache.
    for (const post of posts) {
      await res.revalidate(`/${post.slug}`)
    }
    console.log(`✅ Revalidated ${posts.length} post pages`)

    // 3. Revalidate index pages built without Notion credentials
    const indexPaths = ["/", "/search", "/series", "/graph", "/ontology"]
    for (const path of indexPaths) {
      await res.revalidate(path)
    }
    console.log(`✅ Revalidated ${indexPaths.join(", ")}`)

    // 4. Warm sitemap cache
    try {
      await fetch(`${getInternalOrigin()}/sitemap.xml`)
      console.log("✅ Warmed sitemap cache")
    } catch (sitemapErr) {
      console.error("⚠️ Failed to warm sitemap cache:", sitemapErr)
    }

    console.log("🎉 ISR cache initialization complete!")

    return res.json({
      success: true,
      postsRevalidated: posts.length,
      timestamp: new Date().toISOString(),
    })
  } catch (err) {
    console.error("❌ ISR cache initialization failed:", err)
    return res.status(500).json({
      success: false,
      error: "failed to initialize cache",
    })
  }
}
