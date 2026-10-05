/**
 * @jest-environment node
 */

import type { BuiltGraph } from "src/apis/notion-client/getBuiltGraph"
import type { TPost, TPosts } from "src/types"
import type { NotionGraph } from "src/types/notionGraph"

jest.mock("src/apis/notion-client/getPosts", () => ({ getPosts: jest.fn() }))
jest.mock("src/apis/notion-client/getNotionGraph", () => ({ getNotionGraph: jest.fn() }))
jest.mock("src/apis/notion-client/getBuiltGraph", () => ({ getBuiltGraph: jest.fn() }))
jest.mock("src/apis/notion-client/notionClient", () => ({ getOfficialNotionClient: jest.fn() }))
jest.mock("src/libs/cache", () => ({ cacheStore: {}, keys: {} }))
jest.mock("src/apis/vector/qdrantGraphStore", () => ({
  getGraphSnapshot: jest.fn(),
  upsertGraphSnapshot: jest.fn(),
}))
jest.mock("src/libs/utils/logger", () => ({ warnLog: jest.fn(), debugLog: jest.fn() }))

import {
  readGraphSnapshotFromQdrant,
  refreshGraphSnapshotInQdrant,
} from "src/apis/notion-client/graphSnapshot"
import { getBuiltGraph } from "src/apis/notion-client/getBuiltGraph"
import { computePostsGraphHash } from "src/apis/notion-client/graphHash"
import { getGraphSnapshot, upsertGraphSnapshot } from "src/apis/vector/qdrantGraphStore"

const post = (id: string, overrides: Partial<TPost> = {}): TPost => ({
  id,
  title: `Post ${id}`,
  slug: `post-${id}`,
  createdTime: "2026-01-01T00:00:00.000Z",
  lastEditedTime: "2026-01-03T00:00:00.000Z",
  date: { start_date: "2026-01-01" },
  type: ["Post"],
  status: ["Public"],
  tags: ["shared"],
  fullWidth: false,
  ...overrides,
})

const posts: TPosts = [post("a"), post("b")]

const notionGraph = {
  version: "v2",
  generatedAt: "2026-07-08T00:00:00.000Z",
  nodes: [
    { kind: "post", id: "a", slug: "post-a", title: "Post a", category: "misc", tags: ["shared"], readTime: 4 },
    { kind: "post", id: "b", slug: "post-b", title: "Secret old title", category: "misc", tags: ["shared"], readTime: 4 },
    { kind: "tag", id: "tag:shared", title: "shared" },
  ],
  edges: [
    { source: "a", target: "b", type: "mention", weight: 1 },
    { source: "a", target: "tag:shared", type: "has-tag", weight: 1 },
    { source: "b", target: "tag:shared", type: "has-tag", weight: 1 },
  ],
} as NotionGraph

const builtGraph = { nodes: [], edges: [], cats: [], catCenters: {}, generatedAt: notionGraph.generatedAt } as BuiltGraph

beforeEach(() => {
  jest.clearAllMocks()
  ;(getBuiltGraph as jest.Mock).mockResolvedValue(builtGraph)
})

describe("graphSnapshot", () => {
  it("serves a matching snapshot unchanged", async () => {
    ;(getGraphSnapshot as jest.Mock).mockResolvedValue({ graphHash: computePostsGraphHash(posts), notionGraph, builtGraph })

    await expect(readGraphSnapshotFromQdrant(posts)).resolves.toEqual({ builtGraph, isStale: false })
    expect(getBuiltGraph).not.toHaveBeenCalled()
  })

  it("marks the snapshot stale when only post metadata changes", async () => {
    ;(getGraphSnapshot as jest.Mock).mockResolvedValue({ graphHash: computePostsGraphHash(posts), notionGraph, builtGraph })

    await expect(readGraphSnapshotFromQdrant([post("a", { title: "Renamed" }), post("b")])).resolves.toMatchObject({ isStale: true })
  })

  it("prunes a post that became private from a stale snapshot before serving it", async () => {
    ;(getGraphSnapshot as jest.Mock).mockResolvedValue({ graphHash: "old", notionGraph, builtGraph })

    await readGraphSnapshotFromQdrant([post("a"), post("b", { status: ["Private"] })])

    const served = (getBuiltGraph as jest.Mock).mock.calls[0][0].notionGraph as NotionGraph
    expect(served.nodes.map((node) => node.id)).toEqual(["a", "tag:shared"])
    expect(served.edges).toEqual([{ source: "a", target: "tag:shared", type: "has-tag", weight: 1 }])
  })

  it("does not persist a partial graph and asks for a retry", async () => {
    const result = await refreshGraphSnapshotInQdrant({ posts, notionGraph: { ...notionGraph, partial: true }, builtGraph })

    expect(upsertGraphSnapshot).not.toHaveBeenCalled()
    expect(result).toMatchObject({ persisted: false, needsRetry: true })
  })

  it("asks for a retry when snapshot persistence fails, but not when the store is disabled", async () => {
    ;(upsertGraphSnapshot as jest.Mock).mockRejectedValueOnce(new Error("down")).mockResolvedValueOnce(false)

    await expect(refreshGraphSnapshotInQdrant({ posts, notionGraph, builtGraph })).resolves.toMatchObject({ needsRetry: true })
    await expect(refreshGraphSnapshotInQdrant({ posts, notionGraph, builtGraph })).resolves.toMatchObject({ needsRetry: false })
  })
})
