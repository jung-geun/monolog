import { cacheStore, keys } from "src/libs/cache"
import { CONFIG } from "site.config"
import type { NotionGraph } from "src/types/notionGraph"
import { computePostsGraphHash } from "./graphHash"
import { buildNotionGraph } from "./buildNotionGraph"
import { getPosts } from "./getPosts"

const GRAPH_TTL_MS = Math.floor(CONFIG.revalidateTime * 1000)


export async function getNotionGraph(options?: {
  bypassCache?: boolean
}): Promise<NotionGraph> {
  const posts = await getPosts()
  const hash = computePostsGraphHash(posts)
  const key = keys.notionGraph(hash)

  if (options?.bypassCache) {
    const fresh = await buildNotionGraph()
    if (!fresh.partial) await cacheStore.set(key, fresh, GRAPH_TTL_MS)
    return fresh
  }
  return cacheStore.getOrSet(key, GRAPH_TTL_MS, buildNotionGraph, {
    isCacheable: (g: NotionGraph) => !g.partial,
  })
}
