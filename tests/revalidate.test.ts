/**
 * @jest-environment node
 */

import type { NextApiRequest, NextApiResponse } from "next"
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

jest.mock("src/apis/notion-client/graphSnapshot", () => ({
  refreshGraphSnapshotInQdrant: jest.fn(),
}))

jest.mock("src/libs/cache", () => ({
  cacheStore: {
    clear: jest.fn(),
  },
}))

jest.mock("src/libs/utils/auth/verifyToken", () => ({
  verifyRevalidateToken: jest.fn(),
}))

import handler from "src/pages/api/revalidate"
import { getBuiltGraph } from "src/apis/notion-client/getBuiltGraph"
import { refreshGraphSnapshotInQdrant } from "src/apis/notion-client/graphSnapshot"
import { getNotionGraph } from "src/apis/notion-client/getNotionGraph"
import { getPosts } from "src/apis/notion-client/getPosts"
import { cacheStore } from "src/libs/cache"
import { verifyRevalidateToken } from "src/libs/utils/auth/verifyToken"

interface RequestStub {
  headers: Record<string, string | undefined>
  query: Record<string, string | string[] | undefined>
}

interface ResponseStub {
  statusCode?: number
  body?: unknown
  status: (code: number) => ResponseStub
  json: (payload: unknown) => ResponseStub
  send: (payload: string) => ResponseStub
  revalidate: jest.MockedFunction<(path: string) => Promise<void>>
}

const posts = [
  {
    id: "post-a",
    title: "Post A",
    slug: "hello-world",
    createdTime: "2026-01-01T00:00:00.000Z",
    date: { start_date: "2026-01-01" },
    type: ["Post"],
    status: ["Public"],
    fullWidth: false,
  },
  {
    id: "post-b",
    title: "Post B",
    slug: "second-post",
    createdTime: "2026-01-02T00:00:00.000Z",
    date: { start_date: "2026-01-02" },
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
      slug: "hello-world",
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
      slug: "hello-world",
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

function createReq(overrides: Partial<RequestStub> = {}): RequestStub {
  return {
    headers: {
      host: "example.test",
      "x-forwarded-proto": "http",
    },
    query: {},
    ...overrides,
  }
}

function createRes(): ResponseStub {
  const res: ResponseStub = {
    statusCode: undefined,
    body: undefined,
    status(code: number) {
      res.statusCode = code
      return res
    },
    json(payload: unknown) {
      res.body = payload
      return res
    },
    send(payload: string) {
      res.body = payload
      return res
    },
    revalidate: jest.fn(async (_path: string) => undefined),
  }

  return res
}

async function invoke(req: RequestStub, res: ResponseStub): Promise<void> {
  await handler(req as unknown as NextApiRequest, res as unknown as NextApiResponse)
}

const originalSetImmediate = global.setImmediate
const originalFetch = global.fetch
const originalPort = process.env.PORT
let backgroundWork: Promise<void> | null = null
let fetchMock: jest.MockedFunction<typeof fetch>

beforeEach(() => {
  jest.clearAllMocks()
  jest.spyOn(console, "info").mockImplementation(() => undefined)
  jest.spyOn(console, "error").mockImplementation(() => undefined)

  backgroundWork = null
  global.setImmediate = ((callback: (...args: readonly unknown[]) => unknown, ...args: readonly unknown[]) => {
    backgroundWork = Promise.resolve(callback(...args)).then(() => undefined)
    return {} as unknown as NodeJS.Immediate
  }) as typeof setImmediate

  fetchMock = jest.fn().mockResolvedValue(new Response("", { status: 200 })) as jest.MockedFunction<
    typeof fetch
  >
  global.fetch = fetchMock
  process.env.PORT = "3411"

  ;(verifyRevalidateToken as jest.Mock).mockReturnValue(true)
  ;(cacheStore.clear as jest.Mock).mockResolvedValue(undefined)
  ;(getPosts as jest.Mock).mockResolvedValue(posts)
  ;(getNotionGraph as jest.Mock).mockResolvedValue(notionGraph)
  ;(getBuiltGraph as jest.Mock).mockResolvedValue(builtGraph)
  ;(refreshGraphSnapshotInQdrant as jest.Mock).mockResolvedValue({
    graphHash: "hash-a",
    notionGraph,
    builtGraph,
  })
})

afterEach(() => {
  global.setImmediate = originalSetImmediate
  global.fetch = originalFetch
  if (originalPort === undefined) delete process.env.PORT
  else process.env.PORT = originalPort
  jest.restoreAllMocks()
})

describe("/api/revalidate", () => {
  it("runs the full background revalidation with the same notionGraph passed through graph rebuild and snapshot refresh", async () => {
    const req = createReq({
      headers: {
        host: "attacker.example",
        "x-forwarded-proto": "https",
      },
    })
    const res = createRes()

    await invoke(req, res)

    expect(res.body).toEqual({ revalidated: true, status: "processing" })
    expect(backgroundWork).not.toBeNull()

    await backgroundWork

    expect(cacheStore.clear).toHaveBeenCalledTimes(1)
    expect(getPosts).toHaveBeenCalledWith({ bypassCache: true })
    expect(getNotionGraph).toHaveBeenCalledWith({ bypassCache: true })
    expect(getBuiltGraph).toHaveBeenCalledWith({
      bypassCache: true,
      notionGraph,
    })
    expect(refreshGraphSnapshotInQdrant).toHaveBeenCalledWith({
      posts,
      notionGraph,
      builtGraph,
      bypassCache: true,
    })
    expect((getPosts as jest.Mock).mock.invocationCallOrder[0]).toBeLessThan(
      (getNotionGraph as jest.Mock).mock.invocationCallOrder[0]
    )
    expect((getNotionGraph as jest.Mock).mock.invocationCallOrder[0]).toBeLessThan(
      (getBuiltGraph as jest.Mock).mock.invocationCallOrder[0]
    )
    expect((getBuiltGraph as jest.Mock).mock.invocationCallOrder[0]).toBeLessThan(
      (refreshGraphSnapshotInQdrant as jest.Mock).mock.invocationCallOrder[0]
    )
    expect(
      (refreshGraphSnapshotInQdrant as jest.Mock).mock.invocationCallOrder[0]
    ).toBeLessThan(fetchMock.mock.invocationCallOrder[0])
    expect(res.revalidate.mock.calls.map(([path]) => path)).toEqual([
      "/",
      "/graph",
      "/hello-world",
      "/second-post",
    ])
    expect(fetchMock).toHaveBeenCalledWith("http://127.0.0.1:3411/graphs/notion-graph.json")
  })
})
