import { TPost } from "src/types"
import { getPosts } from "./getPosts"

/**
 * Get a single post by slug. Uses cached posts first; falls back to a fresh
 * bypass fetch only when the slug is not found in the cache.
 */
export const getPostBySlug = async (slug: string): Promise<TPost | null> => {
  const cachedPosts = await getPosts()
  const post = cachedPosts.find((p) => p.slug === slug)
  if (post) return post

  // Not in cache — do one fresh fetch
  console.log(`⚠️  [getPostBySlug] "${slug}" not in cache, retrying with bypass`)
  const freshPosts = await getPosts({ bypassCache: true })
  return freshPosts.find((p) => p.slug === slug) ?? null
}
