import { cacheStore, keys } from "src/libs/cache"
import { buildNotionGraph } from "./buildNotionGraph"
import { NotionGraph } from "src/types/notionGraph"
import { CONFIG } from "site.config"

const GRAPH_TTL_MS = Math.floor(CONFIG.revalidateTime * 1000)

export async function getNotionGraph(options?: {
  bypassCache?: boolean
}): Promise<NotionGraph> {
  const key = keys.notionGraph()
  if (options?.bypassCache) {
    const fresh = await buildNotionGraph()
    await cacheStore.set(key, fresh, GRAPH_TTL_MS)
    return fresh
  }
  return cacheStore.getOrSet(key, GRAPH_TTL_MS, buildNotionGraph)
}
