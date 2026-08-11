/**
 * @jest-environment node
 */

import { createHash } from "crypto"
import type { BuiltGraph } from "src/apis/notion-client/getBuiltGraph"
import type { TPosts } from "src/types"
import type { NotionGraph } from "src/types/notionGraph"

jest.mock("src/apis/notion-client/getPosts", () => ({
  getPosts: jest.fn(),
}))

jest.mock("src/apis/notion-client/getNotionGraph", () => ({
  getNotionGraph: jest.fn(),
}))

jest.mock("src/apis/notion-client/getBuiltGraph", () => ({
  getBuiltGraph: jest.fn(),
}))

jest.mock("src/apis/vector/qdrantGraphStore", () => ({
  getGraphSnapshot: jest.fn(),
  upsertGraphSnapshot: jest.fn(),
}))

jest.mock("src/libs/utils/logger", () => ({
  warnLog: jest.fn(),
}))

import {
  readGraphSnapshotFromQdrant,
  refreshGraphSnapshotInQdrant,
  refreshStaleGraphSnapshotInQdrant,
} from "src/apis/notion-client/graphSnapshot"
import { getBuiltGraph } from "src/apis/notion-client/getBuiltGraph"
import { getNotionGraph } from "src/apis/notion-client/getNotionGraph"
import { getPosts } from "src/apis/notion-client/getPosts"
import {
  getGraphSnapshot,
  upsertGraphSnapshot,
} from "src/apis/vector/qdrantGraphStore"
import { warnLog } from "src/libs/utils/logger"

const posts = [
  {
    id: "post-b",
    title: "Post B",
    slug: "post-b",
    createdTime: "2026-01-02T00:00:00.000Z",
    date: { start_date: "2026-01-02" },
    type: ["Post"],
    status: ["Public"],
    fullWidth: false,
  },
  {
    id: "post-a",
    title: "Post A",
    slug: "post-a",
    createdTime: "2026-01-01T00:00:00.000Z",
    lastEditedTime: "2026-01-03T00:00:00.000Z",
    date: { start_date: "2026-01-01" },
    type: ["Post"],
    status: ["Public"],
    fullWidth: false,
  },
] as TPosts

const notionGraph = {
  version: "v1",
  generatedAt: "2026-07-08T00:00:00.000Z",
  nodes: [
    {
      kind: "post",
      id: "post-a",
      slug: "post-a",
      title: "Post A",
      category: "notes",
      tags: ["tag-a"],
      readTime: 4,
    },
  ],
  edges: [],
} as NotionGraph

const builtGraph = {
  nodes: [
    {
      kind: "post",
      id: "post-a",
      title: "Post A",
      slug: "post-a",
      category: "notes",
      tags: ["tag-a"],
      readTime: 4,
      degree: 0,
      x: 120,
      y: 180,
      color: "#8da874",
    },
  ],
  edges: [],
  cats: ["notes"],
  catCenters: {
    notes: { x: 120, y: 180 },
  },
  generatedAt: notionGraph.generatedAt,
} as BuiltGraph

function expectedGraphHash(currentPosts: TPosts): string {
  const signature = currentPosts
    .map((post) => `${post.id}:${post.lastEditedTime ?? post.createdTime}`)
    .sort()
    .join("|")

  return createHash("sha1").update(signature).digest("hex").slice(0, 16)
}

beforeEach(() => {
  jest.clearAllMocks()
})

describe("graphSnapshot", () => {
  it("returns a matching snapshot without rebuilding it", async () => {
    ;(getGraphSnapshot as jest.Mock).mockResolvedValue({
      graphHash: expectedGraphHash(posts),
      notionGraph,
      builtGraph,
    })

    await expect(readGraphSnapshotFromQdrant(posts)).resolves.toEqual({
      builtGraph,
      isStale: false,
    })
    expect(getGraphSnapshot).toHaveBeenCalledWith()
    expect(getPosts).not.toHaveBeenCalled()
  })

  it("marks a valid snapshot as stale when posts have changed", async () => {
    ;(getGraphSnapshot as jest.Mock).mockResolvedValue({
      graphHash: "stale-hash",
      notionGraph,
      builtGraph,
    })

    await expect(readGraphSnapshotFromQdrant(posts)).resolves.toEqual({
      builtGraph,
      isStale: true,
    })
  })

  it("deduplicates concurrent stale snapshot refreshes", async () => {
    const pendingNotionGraph = new Promise<NotionGraph>((resolve) => {
      ;(getNotionGraph as jest.Mock).mockImplementationOnce(async () => resolve(notionGraph))
    })
    ;(getBuiltGraph as jest.Mock).mockResolvedValue(builtGraph)
    ;(upsertGraphSnapshot as jest.Mock).mockResolvedValue(undefined)

    refreshStaleGraphSnapshotInQdrant(posts)
    refreshStaleGraphSnapshotInQdrant(posts)

    await pendingNotionGraph
    await Promise.resolve()

    expect(getNotionGraph).toHaveBeenCalledTimes(1)
    expect(getNotionGraph).toHaveBeenCalledWith({ bypassCache: true })
  })

  it("persists the supplied notionGraph and builtGraph under the current posts hash", async () => {
    ;(upsertGraphSnapshot as jest.Mock).mockResolvedValue(true)

    const result = await refreshGraphSnapshotInQdrant({
      posts,
      notionGraph,
      builtGraph,
      bypassCache: true,
    })

    expect(upsertGraphSnapshot).toHaveBeenCalledWith(
      expectedGraphHash(posts),
      notionGraph,
      builtGraph
    )
    expect(result).toEqual({
      graphHash: expectedGraphHash(posts),
      notionGraph,
      builtGraph,
      persisted: true,
      needsRetry: false,
    })
    expect(getPosts).not.toHaveBeenCalled()
    expect(getNotionGraph).not.toHaveBeenCalled()
    expect(getBuiltGraph).not.toHaveBeenCalled()
  })

  it("does not retry a complete graph when the snapshot store is disabled", async () => {
    ;(upsertGraphSnapshot as jest.Mock).mockResolvedValue(false)

    await expect(
      refreshGraphSnapshotInQdrant({ posts, notionGraph, builtGraph })
    ).resolves.toMatchObject({
      persisted: false,
      needsRetry: false,
    })
  })

  it("returns partial snapshots without persisting them to Qdrant", async () => {
    const partialNotionGraph = {
      ...notionGraph,
      partial: true,
    } as NotionGraph

    const result = await refreshGraphSnapshotInQdrant({
      posts,
      notionGraph: partialNotionGraph,
      builtGraph,
    })

    expect(upsertGraphSnapshot).not.toHaveBeenCalled()
    expect(result).toEqual({
      graphHash: expectedGraphHash(posts),
      notionGraph: partialNotionGraph,
      builtGraph,
      persisted: false,
      needsRetry: true,
    })
  })

  it("logs and still returns the snapshot when Qdrant persistence fails", async () => {
    const err = new Error("persist failed")
    ;(upsertGraphSnapshot as jest.Mock).mockRejectedValue(err)

    const result = await refreshGraphSnapshotInQdrant({
      posts,
      notionGraph,
      builtGraph,
    })

    expect(warnLog).toHaveBeenCalledWith(
      "[graphSnapshot] failed to persist graph snapshot:",
      err
    )
    expect(result).toEqual({
      graphHash: expectedGraphHash(posts),
      notionGraph,
      builtGraph,
      persisted: false,
      needsRetry: true,
    })
  })
})
