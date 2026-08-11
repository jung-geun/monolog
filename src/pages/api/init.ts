import { NextApiRequest, NextApiResponse } from "next"
import { getPosts } from "../../apis"
import { TPost } from "../../types"
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

    // 2. Revalidate all post pages to add them to ISR cache
    const revalidateRequests = posts.map((post: TPost) =>
      res.revalidate(`/${post.slug}`)
    )
    await Promise.all(revalidateRequests)
    console.log(`✅ Revalidated ${posts.length} post pages`)

    // 3. Revalidate homepage
    await res.revalidate("/")
    console.log("✅ Revalidated homepage")

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