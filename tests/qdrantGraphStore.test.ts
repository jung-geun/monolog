/**
 * @jest-environment node
 */

import type { BuiltGraph } from "src/apis/notion-client/getBuiltGraph"
import type { NotionGraph } from "src/types/notionGraph"

const mockClient = {
  getCollections: jest.fn(),
  createCollection: jest.fn(),
  upsert: jest.fn(),
  retrieve: jest.fn(),
}

jest.mock("src/apis/vector/qdrantClient", () => ({
  getQdrantClient: jest.fn(() => mockClient),
}))

jest.mock("src/libs/utils/logger", () => ({
  warnLog: jest.fn(),
}))

import {
  GRAPH_SNAPSHOT_COLLECTION,
  GRAPH_SNAPSHOT_POINT_ID,
  GRAPH_SNAPSHOT_SCHEMA_VERSION,
  getGraphSnapshot,
  upsertGraphSnapshot,
} from "src/apis/vector/qdrantGraphStore"
import { warnLog } from "src/libs/utils/logger"

const notionGraph = {
  version: "v1",
  generatedAt: "2026-07-08T00:00:00.000Z",
  nodes: [
    {
      kind: "post",
      id: "post-1",
      slug: "hello-world",
      title: "Hello World",
      category: "notes",
      tags: ["tag-a"],
      readTime: 3,
    },
    {
      kind: "tag",
      id: "tag-a",
      title: "tag-a",
    },
  ],
  edges: [
    {
      source: "post-1",
      target: "tag-a",
      type: "has-tag",
      weight: 2,
    },
  ],
} as NotionGraph

const builtGraph = {
  nodes: [
    {
      kind: "post",
      id: "post-1",
      title: "Hello World",
      slug: "hello-world",
      category: "notes",
      tags: ["tag-a"],
      readTime: 3,
      degree: 1,
      x: 120,
      y: 200,
      color: "#8da874",
    },
    {
      kind: "tag",
      id: "tag-a",
      title: "tag-a",
      degree: 1,
      x: 220,
      y: 240,
      color: "#2e8b57",
    },
  ],
  edges: [
    {
      a: 0,
      b: 1,
      type: "has-tag",
      weight: 2,
      sameCategory: false,
    },
  ],
  cats: ["notes"],
  catCenters: {
    notes: { x: 120, y: 200 },
  },
  generatedAt: notionGraph.generatedAt,
} as BuiltGraph

const originalQdrantUrl = process.env.QDRANT_URL

beforeEach(() => {
  jest.clearAllMocks()
  process.env.QDRANT_URL = "http://qdrant.test"
  mockClient.getCollections.mockResolvedValue({ collections: [] })
  mockClient.createCollection.mockResolvedValue(undefined)
  mockClient.upsert.mockResolvedValue(undefined)
  mockClient.retrieve.mockResolvedValue([])
})

afterAll(() => {
  if (originalQdrantUrl === undefined) {
    delete process.env.QDRANT_URL
    return
  }
  process.env.QDRANT_URL = originalQdrantUrl
})

describe("qdrantGraphStore", () => {
  it("creates the snapshot collection when missing and upserts the graph snapshot payload", async () => {
    await upsertGraphSnapshot("hash-a", notionGraph, builtGraph)

    expect(mockClient.createCollection).toHaveBeenCalledWith(GRAPH_SNAPSHOT_COLLECTION, {
      vectors: { size: 1, distance: "Dot" },
      on_disk_payload: true,
      timeout: 5,
    })
    expect(mockClient.upsert).toHaveBeenCalledWith(GRAPH_SNAPSHOT_COLLECTION, {
      wait: true,
      timeout: 10,
      points: [
        {
          id: GRAPH_SNAPSHOT_POINT_ID,
          vector: [1],
          payload: {
            kind: "notion-graph-snapshot",
            schemaVersion: GRAPH_SNAPSHOT_SCHEMA_VERSION,
            graphHash: "hash-a",
            generatedAt: builtGraph.generatedAt,
            postCount: 1,
            edgeCount: notionGraph.edges.length,
            notionGraph,
            builtGraph,
          },
        },
      ],
    })
  })
  it("continues to upsert when another worker creates the snapshot collection first", async () => {
    mockClient.createCollection.mockRejectedValue({ status: 409 })

    await expect(upsertGraphSnapshot("hash-a", notionGraph, builtGraph)).resolves.toBeUndefined()

    expect(mockClient.upsert).toHaveBeenCalledTimes(1)
  })


  it("skips createCollection when the snapshot collection already exists", async () => {
    mockClient.getCollections.mockResolvedValue({
      collections: [{ name: GRAPH_SNAPSHOT_COLLECTION }],
    })

    await upsertGraphSnapshot("hash-a", notionGraph, builtGraph)

    expect(mockClient.createCollection).not.toHaveBeenCalled()
    expect(mockClient.upsert).toHaveBeenCalledTimes(1)
  })

  it("returns the stored notionGraph and builtGraph only when kind, schema, and hash match", async () => {
    mockClient.retrieve.mockResolvedValue([
      {
        payload: {
          kind: "notion-graph-snapshot",
          schemaVersion: GRAPH_SNAPSHOT_SCHEMA_VERSION,
          graphHash: "hash-a",
          generatedAt: builtGraph.generatedAt,
          postCount: 1,
          edgeCount: notionGraph.edges.length,
          notionGraph,
          builtGraph,
        },
      },
    ])

    await expect(getGraphSnapshot("hash-a")).resolves.toEqual({
      graphHash: "hash-a",
      notionGraph,
      builtGraph,
    })
  })

  it("returns null for a stale stored graph hash", async () => {
    mockClient.retrieve.mockResolvedValue([
      {
        payload: {
          kind: "notion-graph-snapshot",
          schemaVersion: GRAPH_SNAPSHOT_SCHEMA_VERSION,
          graphHash: "hash-a",
          generatedAt: builtGraph.generatedAt,
          postCount: 1,
          edgeCount: notionGraph.edges.length,
          notionGraph,
          builtGraph,
        },
      },
    ])

    await expect(getGraphSnapshot("hash-b")).resolves.toBeNull()
    expect(warnLog).toHaveBeenCalledWith(
      "[qdrantGraphStore] graph snapshot hash mismatch",
      "hash-a"
    )
  })
  it("treats a missing snapshot collection as a cache miss without warning", async () => {
    mockClient.retrieve.mockRejectedValue({
      status: 404,
      data: {
        status: {
          error: "Not found: Collection `post_graph_snapshots` doesn't exist!",
        },
      },
    })

    await expect(getGraphSnapshot("hash-a")).resolves.toBeNull()
    expect(warnLog).not.toHaveBeenCalled()
  })


  it("returns null when retrieve fails and logs a warning", async () => {
    const err = new Error("qdrant unavailable")
    mockClient.retrieve.mockRejectedValue(err)

    await expect(getGraphSnapshot("hash-a")).resolves.toBeNull()
    expect(warnLog).toHaveBeenCalledWith(
      "[qdrantGraphStore] failed to read graph snapshot:",
      err
    )
  })
})
