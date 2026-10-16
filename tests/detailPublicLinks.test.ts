/** @jest-environment node */
import { hydrate, QueryClient, type DehydratedState } from "@tanstack/react-query"
import type { Block, ExtendedRecordMap } from "notion-types"
import type { TPost } from "src/types"

jest.mock("src/apis", () => ({ getPosts: jest.fn(), getRecordMap: jest.fn(), getRecordMapDatabases: jest.fn() }))
jest.mock("src/libs/content/registry", () => ({ getSlugRedirect: jest.fn(), readContentRecordMap: jest.fn() }))
jest.mock("src/routes/Detail", () => ({ __esModule: true, default: () => null }))
jest.mock("src/components/MetaConfig", () => ({ __esModule: true, default: () => null }))

import { getPosts, getRecordMapDatabases } from "src/apis"
import { readContentRecordMap } from "src/libs/content/registry"
import { getStaticProps } from "src/pages/[slug]"
import { queryKey } from "src/constants/queryKey"
import { renderTranslatedMarkdownDocument } from "src/routes/Detail/PostDetail/translatedMarkdown"

beforeEach(() => jest.useFakeTimers())
afterEach(() => jest.useRealTimers())

it("keeps public Page and detail-only mentions navigable after hydration without exposing private pages in the link map or feed", async () => {
  const post: TPost = {
    id: "11111111-1111-1111-1111-111111111111", slug: "article", title: "Article", summary: "Summary",
    type: ["Post"], status: ["Public"], date: { start_date: "2026-01-01" }, createdTime: "2026-01-01", fullWidth: false,
  }
  const page: TPost = { ...post, id: "22222222-2222-2222-2222-222222222222", slug: "about", type: ["Page"] }
  const detailOnly: TPost = { ...post, id: "33333333-3333-3333-3333-333333333333", slug: "detail-only", status: ["PublicOnDetail"] }
  const privatePage: TPost = { ...page, id: "44444444-4444-4444-4444-444444444444", slug: "private-page", status: ["Private"] }
  const blocks = [
    { id: post.id, type: "page", content: ["mentions"] },
    { id: "mentions", type: "text", properties: { title: [
      ["About", [["p", page.id]]], [" and "], ["Detail", [["p", detailOnly.id]]],
    ] } },
  ]
  const recordMap = {
    block: Object.fromEntries(blocks.map(block => [block.id, { role: "reader", value: block as Block }])),
    collection: {}, collection_view: {}, notion_user: {}, collection_query: {}, signed_urls: {},
  } as ExtendedRecordMap
  jest.mocked(getPosts).mockResolvedValue([post, page, detailOnly, privatePage])
  jest.mocked(readContentRecordMap).mockResolvedValue(recordMap)
  jest.mocked(getRecordMapDatabases).mockResolvedValue(new Map())
  const result = await getStaticProps({ params: { slug: post.slug } })
  if (!("props" in result)) throw new Error("Expected a public detail page")
  const props = await result.props as { dehydratedState: DehydratedState }
  const client = new QueryClient({ defaultOptions: { queries: { gcTime: Infinity } } })
  try {
    hydrate(client, props.dehydratedState)
    const links = client.getQueryData<Pick<TPost, "id" | "slug">[]>(queryKey.publicPageLinks())!
    const detail = client.getQueryData<TPost & { recordMap: ExtendedRecordMap }>(queryKey.post(post.slug))!
    const document = renderTranslatedMarkdownDocument({
      post: detail, article: { title: "Translated article", summary: "Translated summary", recordMap: detail.recordMap },
      allPosts: links, siteUrl: "https://example.com",
    })!
    expect(document.markdown).toContain("[About](https://example.com/about)")
    expect(document.markdown).toContain("[Detail](https://example.com/detail-only)")
    expect(links).toEqual([post, page, detailOnly].map(({ id, slug }) => ({ id, slug })))
    expect(client.getQueryData<TPost[]>(queryKey.posts())?.map(row => row.slug)).toEqual([post.slug])
  } finally {
    client.clear()
  }
})
