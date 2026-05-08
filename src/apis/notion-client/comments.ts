import { getOfficialNotionClient } from "./notionClient"
import type { TComment, TCommentCreateInput } from "src/types/comment"

function dbId(): string {
  const id = process.env.NOTION_COMMENTS_DB_ID
  if (!id) throw new Error("NOTION_COMMENTS_DB_ID is required")
  return id
}

function withTimeout<T>(p: Promise<T>, ms: number): Promise<T> {
  return Promise.race([
    p,
    new Promise<T>((_, reject) =>
      setTimeout(() => reject(new Error(`Notion request timed out after ${ms}ms`)), ms)
    ),
  ])
}

function rt(content: string) {
  return [{ type: "text" as const, text: { content } }]
}

// Notion API v5: database_id ≠ data_source_id for recently created DBs.
// Resolve once via databases.retrieve and cache for the process lifetime.
let resolvedDataSourceId: string | null = null
let resolveInflight: Promise<string> | null = null

async function getDataSourceId(): Promise<string> {
  if (resolvedDataSourceId) return resolvedDataSourceId
  if (resolveInflight) return resolveInflight

  const notion = getOfficialNotionClient()
  resolveInflight = (async () => {
    const meta: any = await withTimeout(
      notion.databases.retrieve({ database_id: dbId() }),
      8000
    )
    const dsId: string | undefined = meta.data_sources?.[0]?.id
    if (!dsId) throw new Error(`No data source found for database ${dbId()}`)
    resolvedDataSourceId = dsId
    return dsId
  })()

  try {
    return await resolveInflight
  } catch (err) {
    resolveInflight = null
    throw err
  }
}

export async function listComments(slug: string): Promise<TComment[]> {
  const notion = getOfficialNotionClient()
  const dsId = await getDataSourceId()
  const response = await withTimeout(
    notion.dataSources.query({
      data_source_id: dsId,
      filter: {
        and: [
          { property: "Slug", rich_text: { equals: slug }, type: "rich_text" as const },
          { property: "Status", select: { equals: "approved" }, type: "select" as const },
        ],
      },
      sorts: [{ timestamp: "created_time", direction: "ascending" }],
      page_size: 100,
    }),
    8000
  )

  return response.results.map((page: any) => ({
    id: page.id,
    slug: page.properties.Slug?.rich_text?.[0]?.plain_text ?? "",
    postId: page.properties.PostId?.rich_text?.[0]?.plain_text ?? "",
    nickname: page.properties.Nickname?.rich_text?.[0]?.plain_text ?? "익명",
    body: page.properties.Body?.rich_text?.[0]?.plain_text ?? "",
    createdAt: page.created_time,
  }))
}

export async function createComment(input: TCommentCreateInput): Promise<TComment> {
  const notion = getOfficialNotionClient()
  const dsId = await getDataSourceId()
  const excerpt = input.body.slice(0, 30).replace(/\n/g, " ")
  const title = `[${input.slug}] ${input.nickname}: ${excerpt}`

  const page = (await withTimeout(
    notion.pages.create({
      parent: { data_source_id: dsId },
      properties: {
        Title: { title: rt(title) },
        Slug: { rich_text: rt(input.slug) },
        PostId: { rich_text: rt(input.postId) },
        Nickname: { rich_text: rt(input.nickname) },
        Body: { rich_text: rt(input.body) },
        Status: { select: { name: "approved" } },
        IpHash: { rich_text: rt(input.ipHash) },
      },
    }),
    8000
  )) as any

  return {
    id: page.id,
    slug: input.slug,
    postId: input.postId,
    nickname: input.nickname,
    body: input.body,
    createdAt: page.created_time,
  }
}
