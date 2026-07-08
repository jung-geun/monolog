import { createHash } from "crypto"
import { isFullPage } from "@notionhq/client"
import type { PageObjectResponse, RichTextItemRequest } from "@notionhq/client/build/src/api-endpoints"
import { getOfficialNotionClient } from "./notionClient"

export type TrackVisitInput = { slug: string; postId: string; visitorId: string }
export type TrackVisitResult = { counted: boolean; count: number }

const REQUEST_TIMEOUT_MS = 8000
const VISIT_COUNT_PROPERTY = "접속자수"

const inFlight = new Map<string, Promise<TrackVisitResult>>()

function visitStatsDataSourceId(): string {
  const id = process.env.NOTION_VISIT_STATS_DATASOURCE_ID
  if (!id) throw new Error("NOTION_VISIT_STATS_DATASOURCE_ID is required")
  return id
}

function visitorSalt(): string {
  const salt = process.env.VISITOR_HASH_SALT
  if (!salt) throw new Error("VISITOR_HASH_SALT is required")
  return salt
}

function hash16(value: string): string {
  return createHash("sha256").update(value).digest("hex").slice(0, 16)
}

function visitKey(postId: string, visitorId: string): string {
  const salt = visitorSalt()
  const visitorHash = hash16(`${visitorId}${salt}`)
  return createHash("sha256")
    .update(`${postId}:${visitorHash}${salt}`)
    .digest("hex")
    .slice(0, 32)
}

function withTimeout<T>(p: Promise<T>, ms: number): Promise<T> {
  return Promise.race([
    p,
    new Promise<T>((_, reject) =>
      setTimeout(() => reject(new Error(`Notion request timed out after ${ms}ms`)), ms)
    ),
  ])
}

function rt(content: string): RichTextItemRequest[] {
  return [{ type: "text", text: { content } }]
}

function pageVisitKey(page: PageObjectResponse): string | undefined {
  const property = page.properties.VisitKey
  if (property?.type !== "rich_text") return undefined
  return property.rich_text[0]?.plain_text
}

async function queryExistingVisit(key: string): Promise<boolean> {
  const notion = getOfficialNotionClient()
  const response = await withTimeout(
    notion.dataSources.query({
      data_source_id: visitStatsDataSourceId(),
      filter: { property: "VisitKey", rich_text: { equals: key }, type: "rich_text" },
      page_size: 1,
    }),
    REQUEST_TIMEOUT_MS
  )

  return response.results.some((result) => isFullPage(result))
}

async function countDistinctVisitKeysForPost(postId: string, ensureKey?: string): Promise<number> {
  const notion = getOfficialNotionClient()
  const dsId = visitStatsDataSourceId()
  const keys = new Set<string>()
  let startCursor: string | undefined

  do {
    const response = await withTimeout(
      notion.dataSources.query({
        data_source_id: dsId,
        filter: { property: "PostId", rich_text: { equals: postId }, type: "rich_text" },
        page_size: 100,
        start_cursor: startCursor,
      }),
      REQUEST_TIMEOUT_MS
    )

    for (const result of response.results) {
      if (!isFullPage(result)) continue
      const key = pageVisitKey(result)
      if (key) keys.add(key)
    }

    startCursor = response.next_cursor ?? undefined
  } while (startCursor)

  if (ensureKey) keys.add(ensureKey)
  return keys.size
}

async function syncPageVisitCount(postId: string, count: number): Promise<void> {
  const notion = getOfficialNotionClient()
  const page = await withTimeout(notion.pages.retrieve({ page_id: postId }), REQUEST_TIMEOUT_MS)
  const property = isFullPage(page) ? page.properties[VISIT_COUNT_PROPERTY] : undefined

  if (property?.type !== "number") {
    throw new Error(`Notion property ${VISIT_COUNT_PROPERTY} must be a number`)
  }

  if (property.number === count) return

  await withTimeout(
    notion.pages.update({
      page_id: postId,
      properties: { [VISIT_COUNT_PROPERTY]: { number: count } },
    }),
    REQUEST_TIMEOUT_MS
  )
}

async function createVisitRow(input: TrackVisitInput, key: string): Promise<void> {
  const notion = getOfficialNotionClient()
  await withTimeout(
    notion.pages.create({
      parent: { data_source_id: visitStatsDataSourceId() },
      properties: {
        Title: { title: rt(`${input.slug}:${key.slice(0, 8)}`) },
        Slug: { rich_text: rt(input.slug) },
        PostId: { rich_text: rt(input.postId) },
        VisitKey: { rich_text: rt(key) },
        FirstVisitedAt: { date: { start: new Date().toISOString() } },
      },
    }),
    REQUEST_TIMEOUT_MS
  )
}

async function trackUniqueVisitUncached(input: TrackVisitInput, key: string): Promise<TrackVisitResult> {
  const exists = await queryExistingVisit(key)
  if (exists) {
    const count = await countDistinctVisitKeysForPost(input.postId, key)
    await syncPageVisitCount(input.postId, count)
    return { counted: false, count }
  }

  await createVisitRow(input, key)
  const count = await countDistinctVisitKeysForPost(input.postId, key)
  await syncPageVisitCount(input.postId, count)
  return { counted: true, count }
}

export async function trackUniqueVisit(input: TrackVisitInput): Promise<TrackVisitResult> {
  const key = visitKey(input.postId, input.visitorId)
  const pending = inFlight.get(key)
  if (pending) return pending

  const promise = trackUniqueVisitUncached(input, key).finally(() => {
    inFlight.delete(key)
  })
  inFlight.set(key, promise)
  return promise
}
