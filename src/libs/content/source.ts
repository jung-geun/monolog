import { isFullPage, type PageObjectResponse } from "@notionhq/client"
import type { TPost } from "src/types"
import { getOfficialNotionClient } from "src/apis/notion-client/notionClient"
import { getRecordMap } from "src/apis/notion-client/getRecordMap"
import { normalizeNotionPost } from "src/apis/notion-client/postModel"
import { isSafePostSlug } from "src/libs/utils/notion/publication"

export type ContentMetadata = { id: string; lastEdited: string; post?: TPost; warning?: string }
export const normalizePageId = (id: string): string => id.replace(/-/g, "").toLowerCase()
export const isContentSlug = isSafePostSlug

function property(page: PageObjectResponse, key: string) {
  return Object.entries(page.properties).find(([name]) => name.toLowerCase() === key)?.[1]
}
function text(page: PageObjectResponse, key: string): string {
  const prop = property(page, key)
  if (prop?.type === "rich_text") return prop.rich_text.map(item => item.plain_text).join("")
  if (prop?.type === "title") return prop.title.map(item => item.plain_text).join("")
  if (prop?.type === "url") return prop.url || ""
  return ""
}
function select(page: PageObjectResponse, key: string): string {
  const prop = property(page, key)
  if (prop?.type === "select") return prop.select?.name || ""
  if (prop?.type === "status") return prop.status?.name || ""
  return ""
}
export function parseContentMetadata(page: PageObjectResponse, dataSourceId: string): ContentMetadata {
  const result: ContentMetadata = { id: page.id, lastEdited: page.last_edited_time }
  const parent = page.parent
  if (page.in_trash || page.archived || parent.type !== "data_source_id" || normalizePageId(parent.data_source_id) !== normalizePageId(dataSourceId)) return result
  const status = select(page, "status")
  const type = select(page, "type")
  const slug = text(page, "slug")
  if (!["Public", "PublicOnDetail", "Private"].includes(status)) return { ...result, warning: "invalid-status" }
  if (!["Post", "Paper", "Page"].includes(type)) return { ...result, warning: "invalid-type" }
  if (!isContentSlug(slug)) return { ...result, warning: "invalid-slug" }
  if (status === "Private") return result
  const dateProp = property(page, "date")
  const date = dateProp?.type === "date" ? dateProp.date?.start : undefined
  if (date && !Number.isFinite(Date.parse(date))) return { ...result, warning: "invalid-publication-date" }
  const post = normalizeNotionPost(page)
  if (!post.title.trim()) return { ...result, warning: "invalid-title" }
  return { ...result, post }
}
function sourceId(): string {
  const id = process.env.NOTION_DATASOURCE_ID
  if (!id) throw new Error("NOTION_DATASOURCE_ID is required for content reconciliation")
  return id
}
export async function listContentMetadata(since?: number): Promise<ContentMetadata[]> {
  const notion = getOfficialNotionClient()
  const id = sourceId()
  const result: ContentMetadata[] = []
  let cursor: string | undefined
  do {
    const response = await notion.dataSources.query({
      data_source_id: id, page_size: 100, ...(cursor ? { start_cursor: cursor } : {}),
      ...(since ? { filter: { timestamp: "last_edited_time" as const, last_edited_time: { on_or_after: new Date(since).toISOString() } } } : {}),
    })
    for (const page of response.results) {
      if (!isFullPage(page)) throw new Error("Incomplete Notion metadata response")
      result.push(parseContentMetadata(page, id))
    }
    if (response.has_more && !response.next_cursor) throw new Error("Incomplete Notion pagination response")
    cursor = response.has_more ? response.next_cursor || undefined : undefined
  } while (cursor)
  return result
}
export async function retrieveContentMetadata(pageId: string): Promise<ContentMetadata> {
  const notion = getOfficialNotionClient()
  try {
    const page = await notion.pages.retrieve({ page_id: pageId })
    if (!isFullPage(page)) throw new Error("Incomplete Notion page response")
    return parseContentMetadata(page, sourceId())
  } catch (error) {
    // Only Notion's explicit object_not_found is a removal. Network/auth errors
    // must not turn a previously public page into a blank/404.
    if (error && typeof error === "object" && "code" in error && error.code === "object_not_found") return { id: pageId, lastEdited: "deleted" }
    throw error
  }
}
// getRecordMap already reduces the root page to its public title.
export function fetchContentBody(pageId: string, lastEditedTime: string, posts: TPost[]) {
  return getRecordMap(pageId, posts, { bypassCache: true, lastEditedTime })
}
