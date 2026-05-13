import { createHash } from "crypto"
import { cacheStore, keys } from "src/libs/cache"
import { getPosts } from "./getPosts"
import { buildNotionGraph } from "./buildNotionGraph"
import { NotionGraph } from "src/types/notionGraph"
import { CONFIG } from "site.config"

const GRAPH_TTL_MS = Math.floor(CONFIG.revalidateTime * 1000)

function computePostsHash(posts: Awaited<ReturnType<typeof getPosts>>): string {
  const sig = posts
    .map((p) => `${p.id}:${p.lastEditedTime ?? p.createdTime}`)
    .sort()
    .join("|")
  return createHash("sha1").update(sig).digest("hex").slice(0, 16)
}

export async function getNotionGraph(options?: {
  bypassCache?: boolean
}): Promise<NotionGraph> {
  const posts = await getPosts()
  const hash = computePostsHash(posts)
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
