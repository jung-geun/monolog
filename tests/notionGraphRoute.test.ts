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

import { getPosts } from "src/apis/notion-client/getPosts"
import {
  readGraphSnapshotFromQdrant,
  refreshGraphSnapshotInQdrant,
  refreshStaleGraphSnapshotInQdrant,
} from "src/apis/notion-client/graphSnapshot"
import { getServerSideProps } from "src/pages/graphs/notion-graph.json"

const posts = [{ id: "post-a", slug: "post-a" }] as TPosts
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
})

describe("/graphs/notion-graph.json", () => {
  it("returns a stale snapshot immediately and starts a background refresh", async () => {
    const res = response()
    ;(readGraphSnapshotFromQdrant as jest.Mock).mockResolvedValue({
      builtGraph: staleGraph,
      isStale: true,
    })

    await getServerSideProps({ res } as any)

    expect(res.write).toHaveBeenCalledWith(JSON.stringify(staleGraph))
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

    expect(res.write).toHaveBeenCalledWith(JSON.stringify(staleGraph))
    expect(res.setHeader).toHaveBeenCalledWith("X-Monolog-Graph-Stale", "0")
    expect(res.setHeader).toHaveBeenCalledWith(
      "Cache-Control",
      "public, s-maxage=86400, stale-while-revalidate=14400"
    )
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
    expect(res.write).toHaveBeenCalledWith(JSON.stringify(refreshedGraph))
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
})
