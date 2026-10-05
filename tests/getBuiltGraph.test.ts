/**
 * @jest-environment node
 */

import type { NotionGraph } from "src/types/notionGraph"
import { forceCollide } from "d3-force"
import { nodeCollisionRadiusForDegree } from "src/libs/utils/graph"

jest.mock("src/apis/notion-client/getNotionGraph", () => ({
  getNotionGraph: jest.fn(),
}))
jest.mock("d3-force", () => ({
  forceSimulation: jest.fn(() => ({
    force: jest.fn().mockReturnThis(),
    stop: jest.fn().mockReturnThis(),
    tick: jest.fn().mockReturnThis(),
  })),
  forceLink: jest.fn(() => ({
    id: jest.fn().mockReturnThis(),
    distance: jest.fn().mockReturnThis(),
    strength: jest.fn().mockReturnThis(),
  })),
  forceManyBody: jest.fn(() => ({
    strength: jest.fn().mockReturnThis(),
  })),
  forceCollide: jest.fn(() => ({})),
  forceX: jest.fn(() => ({
    strength: jest.fn().mockReturnThis(),
  })),
  forceY: jest.fn(() => ({
    strength: jest.fn().mockReturnThis(),
  })),
  forceRadial: jest.fn(() => ({
    strength: jest.fn().mockReturnThis(),
  })),
}))

jest.mock("src/libs/cache", () => ({
  cacheStore: {
    getOrSet: jest.fn(),
    set: jest.fn(),
  },
  keys: {
    builtGraph: jest.fn((hash: string) => `built-graph:${hash}`),
  },
}))

import { getBuiltGraph } from "src/apis/notion-client/getBuiltGraph"
import { getNotionGraph } from "src/apis/notion-client/getNotionGraph"
import { cacheStore, keys } from "src/libs/cache"

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

beforeEach(() => {
  jest.clearAllMocks()
  ;(getNotionGraph as jest.Mock).mockResolvedValue(notionGraph)
  ;(cacheStore.getOrSet as jest.Mock).mockImplementation(
    async (_key: string, _ttl: number, fetcher: () => Promise<unknown>) => fetcher()
  )
  ;(cacheStore.set as jest.Mock).mockResolvedValue(undefined)
})

describe("getBuiltGraph", () => {
  it("uses degree-derived collision spacing in the server layout", async () => {
    await getBuiltGraph({ bypassCache: true, notionGraph })

    const collisionRadius = (forceCollide as jest.Mock).mock.calls[0][0] as (node: { degree: number }) => number
    expect(collisionRadius({ degree: 4 })).toBe(nodeCollisionRadiusForDegree(4))
  })

  it("reuses a layout for unchanged topology and recomputes when an edge changes", async () => {
    await getBuiltGraph({ notionGraph })
    await getBuiltGraph({ notionGraph: { ...notionGraph, generatedAt: "2026-07-09T00:00:00.000Z" } })
    await getBuiltGraph({
      notionGraph: {
        ...notionGraph,
        edges: [{ source: "post-a", target: "tag:tag-a", type: "has-tag", weight: 1 }],
      },
    })

    const [unchanged, sameTopology, changed] = (keys.builtGraph as jest.Mock).mock.calls.map(([hash]) => hash)
    expect(sameTopology).toBe(unchanged)
    expect(changed).not.toBe(unchanged)
  })

  it("returns a partial bypass build without caching it", async () => {
    const partialNotionGraph = {
      ...notionGraph,
      partial: true,
    } as NotionGraph

    const result = await getBuiltGraph({
      bypassCache: true,
      notionGraph: partialNotionGraph,
    })

    expect(result.generatedAt).toBe(partialNotionGraph.generatedAt)
    expect(cacheStore.set).not.toHaveBeenCalled()
  })
})
