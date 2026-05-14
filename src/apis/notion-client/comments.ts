import { getOfficialNotionClient } from "./notionClient"
import type { TComment, TCommentCreateInput } from "src/types/comment"

function dataSourceId(): string {
  const id = process.env.NOTION_COMMENTS_DATASOURCE_ID
  if (!id) {
    if (process.env.NOTION_COMMENTS_DB_ID) {
      throw new Error(
        "NOTION_COMMENTS_DB_ID is deprecated. Use NOTION_COMMENTS_DATASOURCE_ID (the data_source ID). See docs/USAGE.md."
      )
    }
    throw new Error("NOTION_COMMENTS_DATASOURCE_ID is required")
  }
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

export async function listComments(slug: string): Promise<TComment[]> {
  const notion = getOfficialNotionClient()
  const dsId = dataSourceId()
  const response = await withTimeout(
    notion.dataSources.query({
      data_source_id: dsId,
      filter: {
        and: [
          { property: "Slug", rich_text: { equals: slug }, type: "rich_text" as const },
          { property: "Status", select: { equals: "approved" }, type: "select" as const },
        ],
      },
      sorts: [{ timestamp: "created_time", direction: "descending" }],
      page_size: 100,
    }),
    8000
  )

  return response.results
    .slice()
    .reverse()
    .map((page: any) => ({
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
  const dsId = dataSourceId()
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
