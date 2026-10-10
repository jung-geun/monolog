/**
 * @jest-environment node
 */

import type { BuiltGraph } from "src/apis/notion-client/getBuiltGraph"
import type { TPosts } from "src/types"

jest.mock("src/apis/notion-client/getPosts", () => ({
  getPosts: jest.fn(),
}))

jest.mock("src/apis/notion-client/graphSnapshot", () => ({
  readGraphSnapshotFromQdrant: jest.fn(),
  refreshGraphSnapshotInQdrant: jest.fn(),
  refreshStaleGraphSnapshotInQdrant: jest.fn(),
}))

jest.mock("src/apis/vector/qdrantClient", () => ({
  readPostEmbeddings: jest.fn(async () => new Map()),
  normalizeUUID: (id: string) => id,
}))

import { getPosts } from "src/apis/notion-client/getPosts"
import {
  readGraphSnapshotFromQdrant,
  refreshGraphSnapshotInQdrant,
  refreshStaleGraphSnapshotInQdrant,
} from "src/apis/notion-client/graphSnapshot"
import { getServerSideProps } from "src/pages/graphs/notion-graph.json"
import { readPostEmbeddings } from "src/apis/vector/qdrantClient"

const posts = [{
  id: "post-a", slug: "post-a", title: "Post A", status: ["Public"], type: ["Post"],
  createdTime: "2026-01-01T00:00:00.000Z",
}] as TPosts
const staleGraph = {
  nodes: [],
  edges: [],
  cats: [],
  catCenters: {},
  generatedAt: "2026-08-11T00:00:00.000Z",
} as BuiltGraph
const refreshedGraph = {
  ...staleGraph,
  generatedAt: "2026-08-11T00:01:00.000Z",
}

const response = () => ({
  end: jest.fn(),
  setHeader: jest.fn(),
  write: jest.fn(),
})

beforeEach(() => {
  jest.clearAllMocks()
  ;(getPosts as jest.Mock).mockResolvedValue(posts)
  jest.mocked(readPostEmbeddings).mockReset().mockResolvedValue(new Map())
})

describe("/graphs/notion-graph.json", () => {
  it("returns a stale snapshot immediately and starts a background refresh", async () => {
    const res = response()
    ;(readGraphSnapshotFromQdrant as jest.Mock).mockResolvedValue({
      builtGraph: staleGraph,
      isStale: true,
    })

    await getServerSideProps({ res } as any)

    expect(res.setHeader).toHaveBeenCalledWith("X-Monolog-Graph-Stale", "1")
    expect(res.setHeader).toHaveBeenCalledWith("Cache-Control", "no-store")
    expect(refreshStaleGraphSnapshotInQdrant).toHaveBeenCalledWith(posts)
    expect(refreshGraphSnapshotInQdrant).not.toHaveBeenCalled()
  })

  it("does not refresh a current snapshot", async () => {
    const res = response()
    ;(readGraphSnapshotFromQdrant as jest.Mock).mockResolvedValue({
      builtGraph: staleGraph,
      isStale: false,
    })

    await getServerSideProps({ res } as any)

    expect(res.setHeader).toHaveBeenCalledWith("X-Monolog-Graph-Stale", "0")
    expect(refreshStaleGraphSnapshotInQdrant).not.toHaveBeenCalled()
    expect(refreshGraphSnapshotInQdrant).not.toHaveBeenCalled()
  })

  it("builds synchronously only when no valid snapshot exists", async () => {
    const res = response()
    ;(readGraphSnapshotFromQdrant as jest.Mock).mockResolvedValue(null)
    ;(refreshGraphSnapshotInQdrant as jest.Mock).mockResolvedValue({
      builtGraph: refreshedGraph,
      persisted: true,
      needsRetry: false,
    })

    await getServerSideProps({ res } as any)

    expect(refreshGraphSnapshotInQdrant).toHaveBeenCalledWith({ posts })
    expect(res.setHeader).toHaveBeenCalledWith("X-Monolog-Graph-Stale", "0")
    expect(refreshStaleGraphSnapshotInQdrant).not.toHaveBeenCalled()
  })

  it("marks a cache-miss response stale if the generated graph is not persisted", async () => {
    const res = response()
    ;(readGraphSnapshotFromQdrant as jest.Mock).mockResolvedValue(null)
    ;(refreshGraphSnapshotInQdrant as jest.Mock).mockResolvedValue({
      builtGraph: refreshedGraph,
      persisted: false,
      needsRetry: true,
    })

    await getServerSideProps({ res } as any)

    expect(res.setHeader).toHaveBeenCalledWith("X-Monolog-Graph-Stale", "1")
    expect(res.setHeader).toHaveBeenCalledWith("Cache-Control", "no-store")
  })

  it("keeps a usable logical graph but disables search and retries during a vector-store outage", async () => {
    const oldUrl = process.env.QDRANT_URL
    const oldService = process.env.EMBEDDING_SERVICE_URL
    process.env.QDRANT_URL = "http://qdrant.test"
    process.env.EMBEDDING_SERVICE_URL = "http://embedding.test"
    jest.spyOn(console, "warn").mockImplementation(() => {})
    jest.mocked(readPostEmbeddings).mockRejectedValueOnce(new Error("Qdrant unavailable"))
    const graph = { ...staleGraph, nodes: [{ id: "post-a", kind: "post", title: "Post A", x: 0, y: 0 }] } as BuiltGraph
    ;(readGraphSnapshotFromQdrant as jest.Mock).mockResolvedValue({ builtGraph: graph, isStale: false })
    const res = response()
    try {
      await getServerSideProps({ res } as any)
      const body = JSON.parse(res.write.mock.calls[0][0])
      expect(body.embedding).toMatchObject({ embedded: 0, total: 1, searchAvailable: false, pending: true })
      expect(res.setHeader).toHaveBeenCalledWith("X-Monolog-Graph-Stale", "1")
    } finally {
      if (oldUrl === undefined) delete process.env.QDRANT_URL
      else process.env.QDRANT_URL = oldUrl
      if (oldService === undefined) delete process.env.EMBEDDING_SERVICE_URL
      else process.env.EMBEDDING_SERVICE_URL = oldService
      jest.restoreAllMocks()
    }
  })

  it("continues refresh while vectors for a current logical snapshot are pending", async () => {
    const oldUrl = process.env.QDRANT_URL
    const oldService = process.env.EMBEDDING_SERVICE_URL
    process.env.QDRANT_URL = "http://qdrant.test"
    process.env.EMBEDDING_SERVICE_URL = "http://embedding.test"
    ;(readGraphSnapshotFromQdrant as jest.Mock).mockResolvedValue({
      builtGraph: { ...staleGraph, nodes: [{ id: "post-a", kind: "post", title: "Post A", x: 0, y: 0 }] }, isStale: false,
    })
    const res = response()
    try {
      await getServerSideProps({ res } as any)
      const body = JSON.parse(res.write.mock.calls[0][0])
      expect(body.embedding).toMatchObject({ searchAvailable: true, pending: true })
      expect(res.setHeader).toHaveBeenCalledWith("X-Monolog-Graph-Stale", "1")
    } finally {
      if (oldUrl === undefined) delete process.env.QDRANT_URL
      else process.env.QDRANT_URL = oldUrl
      if (oldService === undefined) delete process.env.EMBEDDING_SERVICE_URL
      else process.env.EMBEDDING_SERVICE_URL = oldService
    }
  })
})
