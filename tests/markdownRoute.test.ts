/**
 * @jest-environment node
 */

import type { NextApiRequest, NextApiResponse } from "next"

jest.mock("src/apis", () => ({
  getPosts: jest.fn(),
  getPostBySlug: jest.fn(),
  getRecordMap: jest.fn(),
  getRecordMapDatabases: jest.fn(),
}))

jest.mock("src/libs/utils/notion/markdown", () => ({
  renderPostMarkdown: jest.fn(),
}))

jest.mock("src/libs/utils/logger", () => ({
  errorLog: jest.fn(),
  debugLog: jest.fn(),
}))

jest.mock("site.config", () => ({
  CONFIG: {
    link: "https://blog.pieroot.xyz",
    revalidateTime: 21600,
  },
}))

import handler from "src/pages/api/markdown/[slug]"
import { getPosts, getPostBySlug, getRecordMap, getRecordMapDatabases } from "src/apis"
import { renderPostMarkdown } from "src/libs/utils/notion/markdown"
import { errorLog } from "src/libs/utils/logger"
import type { TPost, TPosts } from "src/types"
import type { ExtendedRecordMap } from "notion-types"

const mockGetPosts = getPosts as jest.MockedFunction<typeof getPosts>
const mockGetPostBySlug = getPostBySlug as jest.MockedFunction<typeof getPostBySlug>
const mockGetRecordMap = getRecordMap as jest.MockedFunction<typeof getRecordMap>
const mockGetRecordMapDatabases = getRecordMapDatabases as jest.MockedFunction<typeof getRecordMapDatabases>
const mockRenderPostMarkdown = renderPostMarkdown as jest.MockedFunction<typeof renderPostMarkdown>
const mockErrorLog = errorLog as jest.MockedFunction<typeof errorLog>

interface RequestStub {
  method?: string
  query: Record<string, string | string[] | undefined>
}

interface ResponseStub {
  statusCode: number
  headers: Record<string, string>
  body: string
  ended: boolean
  setHeader: (key: string, value: string) => void
  getHeader: (key: string) => string | undefined
  end: (chunk?: unknown) => void
}

function createReq(overrides: Partial<RequestStub> = {}): RequestStub {
  return {
    method: "GET",
    query: {},
    ...overrides,
  }
}

function createRes(): ResponseStub {
  const res: ResponseStub = {
    statusCode: 200,
    headers: {},
    body: "",
    ended: false,
    setHeader(key: string, value: string) {
      res.headers[key.toLowerCase()] = value
    },
    getHeader(key: string) {
      return res.headers[key.toLowerCase()]
    },
    end(chunk?: unknown) {
      if (chunk !== undefined && chunk !== null) {
        res.body += String(chunk)
      }
      res.ended = true
    },
  }
  return res
}

async function invoke(req: RequestStub, res: ResponseStub): Promise<void> {
  await handler(req as unknown as NextApiRequest, res as unknown as NextApiResponse)
}

const samplePost: TPost = {
  id: "post-1",
  date: { start_date: "2026-01-01" },
  type: ["Post"],
  slug: "hello-world",
  title: "Hello World",
  status: ["Public"],
  createdTime: "2026-01-01T00:00:00.000Z",
  fullWidth: false,
}

describe("/api/markdown/[slug]", () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it("serves markdown for valid GET request with exact headers and body", async () => {
    mockGetPosts.mockResolvedValue([samplePost] as TPosts)
    mockGetRecordMap.mockResolvedValue({ block: {} } as unknown as ExtendedRecordMap)
    mockGetRecordMapDatabases.mockResolvedValue(new Map())
    mockRenderPostMarkdown.mockReturnValue("# Hello World\n\nContent")

    const req = createReq({ method: "GET", query: { slug: "hello-world" } })
    const res = createRes()

    await invoke(req, res)

    expect(res.statusCode).toBe(200)
    expect(res.getHeader("content-type")).toBe("text/markdown; charset=utf-8")
    expect(res.getHeader("content-disposition")).toBe('inline; filename="hello-world.md"')
    expect(res.getHeader("cache-control")).toBe("public, s-maxage=21600, stale-while-revalidate=3600")
    expect(res.getHeader("link")).toBe('<https://blog.pieroot.xyz/hello-world>; rel="canonical"')
    expect(res.getHeader("content-length")).toBe(String(Buffer.byteLength("# Hello World\n\nContent", "utf8")))
    expect(res.body).toBe("# Hello World\n\nContent")
    expect(res.ended).toBe(true)
  })

  it("formats safe filename for non-ASCII/quote/space slug", async () => {
    const specialPost: TPost = {
      ...samplePost,
      slug: '안녕 "world"!',
    }
    mockGetPosts.mockResolvedValue([specialPost] as TPosts)
    mockGetRecordMap.mockResolvedValue({ block: {} } as unknown as ExtendedRecordMap)
    mockGetRecordMapDatabases.mockResolvedValue(new Map())
    mockRenderPostMarkdown.mockReturnValue("# Special Post")

    const req = createReq({ method: "GET", query: { slug: '안녕 "world"!' } })
    const res = createRes()

    await invoke(req, res)

    expect(res.statusCode).toBe(200)
    expect(res.getHeader("content-disposition")).toBe('inline; filename="world.md"')
  })

  it("executes work and sets identical headers without body bytes for HEAD request", async () => {
    mockGetPosts.mockResolvedValue([samplePost] as TPosts)
    mockGetRecordMap.mockResolvedValue({ block: {} } as unknown as ExtendedRecordMap)
    mockGetRecordMapDatabases.mockResolvedValue(new Map())
    mockRenderPostMarkdown.mockReturnValue("# Hello World\n\nContent")

    const req = createReq({ method: "HEAD", query: { slug: "hello-world" } })
    const res = createRes()

    await invoke(req, res)

    expect(mockGetRecordMap).toHaveBeenCalledWith("post-1", [samplePost])
    expect(mockRenderPostMarkdown).toHaveBeenCalled()
    expect(res.statusCode).toBe(200)
    expect(res.getHeader("content-type")).toBe("text/markdown; charset=utf-8")
    expect(res.getHeader("content-disposition")).toBe('inline; filename="hello-world.md"')
    expect(res.getHeader("cache-control")).toBe("public, s-maxage=21600, stale-while-revalidate=3600")
    expect(res.getHeader("link")).toBe('<https://blog.pieroot.xyz/hello-world>; rel="canonical"')
    expect(res.getHeader("content-length")).toBe(String(Buffer.byteLength("# Hello World\n\nContent", "utf8")))
    expect(res.body).toBe("")
    expect(res.ended).toBe(true)
  })

  it("uses getPostBySlug fallback when slug is not in initial getPosts list", async () => {
    mockGetPosts.mockResolvedValue([])
    mockGetPostBySlug.mockResolvedValue(samplePost)
    mockGetRecordMap.mockResolvedValue({ block: {} } as unknown as ExtendedRecordMap)
    mockGetRecordMapDatabases.mockResolvedValue(new Map())
    mockRenderPostMarkdown.mockReturnValue("# Fallback Post")

    const req = createReq({ method: "GET", query: { slug: "hello-world" } })
    const res = createRes()

    await invoke(req, res)

    expect(mockGetPostBySlug).toHaveBeenCalledWith("hello-world")
    expect(res.statusCode).toBe(200)
    expect(res.body).toBe("# Fallback Post")
  })

  it("returns 404 when fallback post is ineligible (e.g. status Private)", async () => {
    const privatePost: TPost = {
      ...samplePost,
      status: ["Private"],
    }
    mockGetPosts.mockResolvedValue([])
    mockGetPostBySlug.mockResolvedValue(privatePost)

    const req = createReq({ method: "GET", query: { slug: "hello-world" } })
    const res = createRes()

    await invoke(req, res)

    expect(res.statusCode).toBe(404)
    expect(res.getHeader("content-type")).toBe("text/plain; charset=utf-8")
    expect(res.getHeader("cache-control")).toBe("no-store")
    expect(res.body).toBe("Not Found\n")
  })

  it("returns 400 for missing, empty, or array slug", async () => {
    const req1 = createReq({ method: "GET", query: {} })
    const res1 = createRes()
    await invoke(req1, res1)

    expect(res1.statusCode).toBe(400)
    expect(res1.getHeader("content-type")).toBe("text/plain; charset=utf-8")
    expect(res1.getHeader("cache-control")).toBe("no-store")
    expect(res1.body).toBe("Bad Request\n")

    const req2 = createReq({ method: "GET", query: { slug: ["a", "b"] } })
    const res2 = createRes()
    await invoke(req2, res2)

    expect(res2.statusCode).toBe(400)
    expect(res2.body).toBe("Bad Request\n")
  })

  it("returns 404 for unknown slug", async () => {
    mockGetPosts.mockResolvedValue([])
    mockGetPostBySlug.mockResolvedValue(null)

    const req = createReq({ method: "GET", query: { slug: "unknown" } })
    const res = createRes()

    await invoke(req, res)

    expect(res.statusCode).toBe(404)
    expect(res.getHeader("content-type")).toBe("text/plain; charset=utf-8")
    expect(res.getHeader("cache-control")).toBe("no-store")
    expect(res.body).toBe("Not Found\n")
  })

  it("returns 405 Method Not Allowed for non-GET/HEAD methods", async () => {
    const req = createReq({ method: "POST", query: { slug: "hello-world" } })
    const res = createRes()

    await invoke(req, res)

    expect(res.statusCode).toBe(405)
    expect(res.getHeader("allow")).toBe("GET, HEAD")
    expect(res.getHeader("content-type")).toBe("text/plain; charset=utf-8")
    expect(res.getHeader("cache-control")).toBe("no-store")
    expect(res.body).toBe("Method Not Allowed\n")
  })

  it("returns 503 when recordMap is null", async () => {
    mockGetPosts.mockResolvedValue([samplePost] as TPosts)
    mockGetRecordMap.mockResolvedValue(null as unknown as ExtendedRecordMap)

    const req = createReq({ method: "GET", query: { slug: "hello-world" } })
    const res = createRes()

    await invoke(req, res)

    expect(res.statusCode).toBe(503)
    expect(res.getHeader("content-type")).toBe("text/plain; charset=utf-8")
    expect(res.getHeader("cache-control")).toBe("no-store")
    expect(res.getHeader("retry-after")).toBe("60")
    expect(res.body).toBe("Markdown temporarily unavailable\n")
    expect(mockErrorLog).toHaveBeenCalled()
  })

  it("returns 503 without leaking exception text when dependency throws", async () => {
    mockGetPosts.mockResolvedValue([samplePost] as TPosts)
    mockGetRecordMap.mockRejectedValue(new Error("Secret internal Notion DB connection failed"))

    const req = createReq({ method: "GET", query: { slug: "hello-world" } })
    const res = createRes()

    await invoke(req, res)

    expect(res.statusCode).toBe(503)
    expect(res.getHeader("content-type")).toBe("text/plain; charset=utf-8")
    expect(res.getHeader("cache-control")).toBe("no-store")
    expect(res.getHeader("retry-after")).toBe("60")
    expect(res.body).toBe("Markdown temporarily unavailable\n")
    expect(res.body).not.toContain("Secret internal Notion DB connection failed")
    expect(mockErrorLog).toHaveBeenCalled()
  })

  it("returns 503 without leaking exception text when serializer throws for a rootless record map", async () => {
    mockGetPosts.mockResolvedValue([samplePost] as TPosts)
    mockGetRecordMap.mockResolvedValue({ block: {} } as unknown as ExtendedRecordMap)
    mockGetRecordMapDatabases.mockResolvedValue(new Map())
    mockRenderPostMarkdown.mockImplementation(() => {
      throw new Error("Root block not found in recordMap for post id: post-1")
    })

    const req = createReq({ method: "GET", query: { slug: "hello-world" } })
    const res = createRes()

    await invoke(req, res)

    expect(res.statusCode).toBe(503)
    expect(res.getHeader("content-type")).toBe("text/plain; charset=utf-8")
    expect(res.getHeader("cache-control")).toBe("no-store")
    expect(res.getHeader("retry-after")).toBe("60")
    expect(res.body).toBe("Markdown temporarily unavailable\n")
    expect(res.body).not.toContain("Root block not found")
    expect(mockErrorLog).toHaveBeenCalled()
  })
})
