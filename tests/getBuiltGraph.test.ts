/**
 * @jest-environment node
 */

import { createHash } from "crypto"
import type { TPosts } from "src/types"
import type { NotionGraph } from "src/types/notionGraph"

jest.mock("src/apis/notion-client/getPosts", () => ({
  getPosts: jest.fn(),
}))

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
import { getPosts } from "src/apis/notion-client/getPosts"
import { cacheStore, keys } from "src/libs/cache"

const posts = [
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

function expectedGraphHash(currentPosts: TPosts): string {
  const signature = currentPosts
    .map((post) => `${post.id}:${post.lastEditedTime ?? post.createdTime}`)
    .sort()
    .join("|")

  return createHash("sha1").update(signature).digest("hex").slice(0, 16)
}

beforeEach(() => {
  jest.clearAllMocks()
  ;(getPosts as jest.Mock).mockResolvedValue(posts)
  ;(getNotionGraph as jest.Mock).mockResolvedValue(notionGraph)
  ;(cacheStore.getOrSet as jest.Mock).mockImplementation(
    async (_key: string, _ttl: number, fetcher: () => Promise<unknown>) => fetcher()
  )
  ;(cacheStore.set as jest.Mock).mockResolvedValue(undefined)
})

describe("getBuiltGraph", () => {
  it("uses the supplied notionGraph instead of calling getNotionGraph again", async () => {
    const result = await getBuiltGraph({ bypassCache: true, notionGraph })

    expect(getNotionGraph).not.toHaveBeenCalled()
    expect(result.generatedAt).toBe(notionGraph.generatedAt)
    expect(result.nodes).toHaveLength(1)
  })

  it("writes non-partial bypass builds through cacheStore.set", async () => {
    const result = await getBuiltGraph({ bypassCache: true, notionGraph })
    const key = `built-graph:${expectedGraphHash(posts)}`

    expect(keys.builtGraph).toHaveBeenCalledWith(expectedGraphHash(posts))
    expect(cacheStore.set).toHaveBeenCalledWith(
      key,
      result,
      24 * 60 * 60 * 1000
    )
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
