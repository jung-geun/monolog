import { cacheStore, keys } from "src/libs/cache"
import { CONFIG } from "site.config"
import type { NotionGraph } from "src/types/notionGraph"
import { computePostsGraphHash, eligibleGraphPosts } from "./graphHash"
import { buildNotionGraph } from "./buildNotionGraph"
import { getPosts } from "./getPosts"
import type { TPosts } from "src/types"

const GRAPH_TTL_MS = Math.floor(CONFIG.revalidateTime * 1000)


export async function getNotionGraph(options?: {
  bypassCache?: boolean
  posts?: TPosts
}): Promise<NotionGraph> {
  const posts = eligibleGraphPosts(options?.posts ?? await getPosts())
  const hash = computePostsGraphHash(posts)
  const key = keys.notionGraph(hash)

  if (options?.bypassCache) {
    const fresh = await buildNotionGraph(posts)
    if (!fresh.partial) await cacheStore.set(key, fresh, GRAPH_TTL_MS)
    return fresh
  }
  return cacheStore.getOrSet(key, GRAPH_TTL_MS, () => buildNotionGraph(posts), {
    isCacheable: (g: NotionGraph) => !g.partial,
  })
}
