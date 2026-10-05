import { CONFIG } from "site.config"
import type { TPosts } from "src/types"
import { isFullPage } from "@notionhq/client"
import { getOfficialNotionClient } from "./notionClient"
import { cacheStore, keys } from "src/libs/cache"
import { readContentSnapshot } from "src/libs/content/registry"
import { normalizeNotionPost, selectPublicPosts } from "./postModel"

const POSTS_TTL_MS = Math.floor((CONFIG.revalidateTime / 2) * 1000)

// Public page ID → slug index. The durable publication snapshot is authoritative;
// the TTL cache is used only before the first successful synchronization.
export type TPageIndex = Record<string, string>

const buildPageIndex = (posts: TPosts): TPageIndex => {
  const idx: TPageIndex = {}
  for (const p of posts) {
    if (p.id && p.slug) idx[p.id.replace(/-/g, "").toLowerCase()] = p.slug
  }
  return idx
}

const writePageIndex = async (dataSourceId: string, posts: TPosts) => {
  await cacheStore.set(keys.pageIndex(dataSourceId), buildPageIndex(posts), POSTS_TTL_MS)
}

export const getPageIndex = async (): Promise<TPageIndex> => buildPageIndex(await getPosts())

export const getPosts = async (options?: { bypassCache?: boolean }): Promise<TPosts> => {
  const dataSourceId = process.env.NOTION_DATASOURCE_ID
  if (!dataSourceId) {
    if (process.env.NEXT_PHASE === "phase-production-build") return []
    throw new Error("NOTION_DATASOURCE_ID is required")
  }

  if (!options?.bypassCache) {
    const snapshot = await readContentSnapshot()
    if (snapshot !== null) return selectPublicPosts(snapshot)
  }

  const fetchPosts = async () => selectPublicPosts(await fetchNotionPosts())
  const posts = options?.bypassCache
    ? await fetchPosts()
    : await cacheStore.getOrSet(keys.posts(dataSourceId), POSTS_TTL_MS, fetchPosts)

  if (options?.bypassCache) await cacheStore.set(keys.posts(dataSourceId), posts, POSTS_TTL_MS)
  await writePageIndex(dataSourceId, posts)
  return posts
}

export async function fetchNotionPosts(options?: { editedSince?: string }): Promise<TPosts> {
  const dataSourceId = process.env.NOTION_DATASOURCE_ID
  if (!dataSourceId) throw new Error("NOTION_DATASOURCE_ID is required")
  const notion = getOfficialNotionClient()
  const posts: TPosts = []
  let cursor: string | undefined

  do {
    // SDK retries rate limits and transient failures. Never turn an incomplete
    // query or unavailable upstream into a successful empty publication list.
    const response = await notion.dataSources.query({
      data_source_id: dataSourceId,
      page_size: 100,
      ...(cursor ? { start_cursor: cursor } : {}),
      ...(options?.editedSince ? {
        filter: { timestamp: "last_edited_time" as const, last_edited_time: { on_or_after: options.editedSince } },
      } : {}),
    })

    for (const page of response.results) {
      if (!isFullPage(page)) throw new Error("Notion returned incomplete page metadata")
      posts.push(normalizeNotionPost(page))
    }
    if (response.has_more && !response.next_cursor) throw new Error("Notion returned an incomplete pagination cursor")
    cursor = response.has_more ? response.next_cursor ?? undefined : undefined
  } while (cursor)

  return posts
}
