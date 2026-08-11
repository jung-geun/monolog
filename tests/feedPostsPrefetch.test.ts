/**
 * @jest-environment node
 */

jest.mock("src/apis/notion-client/getPosts", () => ({ getPosts: jest.fn() }))
jest.mock("src/routes/Graph", () => ({ __esModule: true, default: () => null }))
jest.mock("src/routes/Ontology", () => ({ __esModule: true, default: () => null }))
import type { GetStaticProps, GetStaticPropsContext } from "next"
import type { TPost } from "src/types"
import { getPosts } from "src/apis/notion-client/getPosts"
import { getStaticProps as graphStaticProps } from "src/pages/graph"
import { getStaticProps as ontologyStaticProps } from "src/pages/ontology"
import { getStaticProps as notFoundStaticProps } from "src/pages/404"

const post = (overrides: Partial<TPost> = {}): TPost => ({
  id: "id-1",
  date: { start_date: "2024-01-01" },
  title: "Visible post",
  slug: "visible-post",
  type: ["Post"],
  status: ["Public"],
  createdTime: "2024-01-01",
  fullWidth: false,
  ...overrides,
})

const hydratedPostSlugs = (result: unknown): string[] | undefined => {
  if (!result || typeof result !== "object" || !("props" in result)) return undefined
  const props = result.props
  if (!props || typeof props !== "object" || !("dehydratedState" in props)) return undefined
  const dehydratedState = props.dehydratedState
  if (!dehydratedState || typeof dehydratedState !== "object" || !("queries" in dehydratedState)) return undefined
  const queries = dehydratedState.queries
  if (!Array.isArray(queries)) return undefined
  const postsQuery = queries.find(
    (query) =>
      query &&
      typeof query === "object" &&
      "queryKey" in query &&
      JSON.stringify(query.queryKey) === '["posts"]' &&
      "state" in query
  )
  if (!postsQuery || typeof postsQuery !== "object" || !("state" in postsQuery)) return undefined
  const state = postsQuery.state
  if (!state || typeof state !== "object" || !("data" in state) || !Array.isArray(state.data)) return undefined
  const data: unknown[] = state.data
  return data.flatMap((value) =>
    value && typeof value === "object" && "slug" in value && typeof value.slug === "string" ? [value.slug] : []
  )
}

const staticPropsContext = {} as unknown as GetStaticPropsContext // These routes do not read getStaticProps context.

beforeEach(() => {
  jest.useFakeTimers()
  jest.clearAllMocks()
  jest.mocked(getPosts).mockResolvedValue([
    post(),
    post({ id: "id-2", title: "Draft", slug: "draft-post", status: ["Private"] }),
  ])
})

afterEach(() => {
  jest.useRealTimers()
})

describe.each<[string, GetStaticProps]>([
  ["/graph", graphStaticProps],
  ["/ontology", ontologyStaticProps],
  ["/404", notFoundStaticProps],
])("%s getStaticProps", (_route, run) => {
  it("hydrates the sidebar post list with only published feed posts", async () => {
    const result = await run(staticPropsContext)

    expect(hydratedPostSlugs(result)).toEqual(["visible-post"])
  })
})
