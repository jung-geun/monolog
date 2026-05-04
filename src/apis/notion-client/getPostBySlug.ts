import { TPost } from "src/types"
import { getPosts } from "./getPosts"
import { debugLog } from "src/libs/utils/logger"

export const getPostBySlug = async (slug: string): Promise<TPost | null> => {
  const cachedPosts = await getPosts()
  const post = cachedPosts.find((p) => p.slug === slug)
  if (post) return post

  debugLog(`[getPostBySlug] "${slug}" not in cache, retrying with bypass`)
  const freshPosts = await getPosts({ bypassCache: true })
  return freshPosts.find((p) => p.slug === slug) ?? null
}
