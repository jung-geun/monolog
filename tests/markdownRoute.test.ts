/**
 * @jest-environment node
 */

import type { NextApiRequest, NextApiResponse } from "next"
import type { Block, ExtendedRecordMap } from "notion-types"
import type { TPost } from "src/types"

jest.mock("src/apis", () => ({
  getPosts: jest.fn(),
  getRecordMap: jest.fn(),
  getRecordMapDatabases: jest.fn(),
}))

jest.mock("src/libs/content/registry", () => ({
  getSlugRedirect: jest.fn(),
  readContentRecordMap: jest.fn(),
}))

jest.mock("src/libs/utils/logger", () => ({
  errorLog: jest.fn(),
  debugLog: jest.fn(),
}))

jest.mock("site.config", () => ({
  CONFIG: { link: "https://blog.pieroot.xyz", revalidateTime: 21600 },
}))

import handler from "src/pages/api/markdown/[slug]"
import { getPosts, getRecordMap, getRecordMapDatabases } from "src/apis"
import { getSlugRedirect, readContentRecordMap } from "src/libs/content/registry"
import { errorLog } from "src/libs/utils/logger"

const mockGetPosts = getPosts as jest.MockedFunction<typeof getPosts>
const mockGetSlugRedirect = getSlugRedirect as jest.MockedFunction<typeof getSlugRedirect>
const mockReadContentRecordMap = readContentRecordMap as jest.MockedFunction<typeof readContentRecordMap>
const mockGetRecordMap = getRecordMap as jest.MockedFunction<typeof getRecordMap>
const mockGetRecordMapDatabases = getRecordMapDatabases as jest.MockedFunction<typeof getRecordMapDatabases>

interface RequestStub {
  method?: string
  query: Record<string, string | string[] | undefined>
}

function createRes() {
  const res = {
    statusCode: 200,
    headers: {} as Record<string, string>,
    body: "",
    ended: false,
    setHeader(key: string, value: string) { res.headers[key.toLowerCase()] = value },
    getHeader(key: string) { return res.headers[key.toLowerCase()] },
    end(chunk?: unknown) {
      if (chunk !== undefined && chunk !== null) res.body += String(chunk)
      res.ended = true
    },
  }
  return res
}

async function invoke(query: RequestStub["query"], method = "GET") {
  const res = createRes()
  await handler({ method, query } as NextApiRequest, res as unknown as NextApiResponse)
  return res
}

const samplePost: TPost = {
  id: "post-1",
  date: { start_date: "2026-01-01" },
  type: ["Post"],
  slug: "hello-world",
  title: "Hello World",
  summary: "Summary",
  status: ["Public"],
  createdTime: "2026-01-01T00:00:00.000Z",
  fullWidth: false,
}
const firstId = "AABBCCDD-0000-1111-2222-334455667788"
const secondId = "AABBCCDD-0000-1111-2222-334455667799"

function makeRecordMap(): ExtendedRecordMap {
  const blocks = [
    { id: samplePost.id, type: "page", content: [firstId, secondId] },
    { id: firstId, type: "text", properties: { title: [["Repeated 한글"]] } },
    { id: secondId, type: "text", properties: { title: [["Repeated 한글"]] } },
  ]
  return {
    block: Object.fromEntries(blocks.map(block => [block.id, { role: "reader", value: block as Block }])),
    collection: {}, collection_view: {}, notion_user: {}, collection_query: {}, signed_urls: {},
  }
}

const expectedMarkdown = [
  "---",
  'title: "Hello World"',
  'description: "Summary"',
  'date: "2026-01-01T00:00:00.000Z"',
  'type: "Post"',
  'canonical_url: "https://blog.pieroot.xyz/hello-world"',
  'markdown_url: "https://blog.pieroot.xyz/hello-world.md"',
  "---", "", "# Hello World", "", "Summary", "", "Repeated 한글", "", "Repeated 한글", "",
].join("\n")
const expectedDocument = {
  markdown: expectedMarkdown,
  blocks: [
    { blockId: "title", startLine: 10, endLine: 10 },
    { blockId: "summary", startLine: 12, endLine: 12 },
    { blockId: "aabbccdd000011112222334455667788", startLine: 14, endLine: 14 },
    { blockId: "aabbccdd000011112222334455667799", startLine: 16, endLine: 16 },
  ],
}

describe("/api/markdown/[slug] with the real exporter", () => {
  beforeEach(() => {
    jest.resetAllMocks()
    mockGetPosts.mockResolvedValue([samplePost])
    mockGetSlugRedirect.mockResolvedValue(null)
    mockReadContentRecordMap.mockResolvedValue(null)
    mockGetRecordMap.mockResolvedValue(makeRecordMap())
    mockGetRecordMapDatabases.mockResolvedValue(new Map())
  })

  it("preserves the plain Markdown bytes and download headers", async () => {
    const res = await invoke({ slug: samplePost.slug })
    expect(res.statusCode).toBe(200)
    expect(res.body).toBe(expectedMarkdown)
    expect(res.headers).toEqual({
      "content-type": "text/markdown; charset=utf-8",
      "content-disposition": 'inline; filename="hello-world.md"',
      "cache-control": "no-store",
      link: '<https://blog.pieroot.xyz/hello-world>; rel="canonical"',
      "content-length": String(Buffer.byteLength(expectedMarkdown, "utf8")),
    })
    expect(res.ended).toBe(true)
  })

  it("exports JSON with exact independent ranges for repeated blocks", async () => {
    const res = await invoke({ slug: samplePost.slug, sourceMap: "1" })
    expect(res.statusCode).toBe(200)
    expect(JSON.parse(res.body)).toEqual(expectedDocument)
    expect(res.getHeader("content-type")).toBe("application/json; charset=utf-8")
    expect(res.getHeader("content-disposition")).toBeUndefined()
    expect(res.getHeader("cache-control")).toBe("no-store")
    expect(res.getHeader("link")).toBe('<https://blog.pieroot.xyz/hello-world>; rel="canonical"')
    expect(res.getHeader("content-length")).toBe(String(Buffer.byteLength(res.body, "utf8")))
  })

  it.each([undefined, "0", ["1", "1"]])("only opts in for a scalar sourceMap=1 (%j)", async sourceMap => {
    const res = await invoke({ slug: samplePost.slug, sourceMap })
    expect(res.statusCode).toBe(200)
    expect(res.body).toBe(expectedMarkdown)
    expect(res.getHeader("content-type")).toBe("text/markdown; charset=utf-8")
  })

  it.each([undefined, "1"])("HEAD matches GET headers and emits no bytes (sourceMap=%s)", async sourceMap => {
    const get = await invoke({ slug: samplePost.slug, sourceMap })
    const head = await invoke({ slug: samplePost.slug, sourceMap }, "HEAD")
    expect(head.statusCode).toBe(get.statusCode)
    expect(head.headers).toEqual(get.headers)
    expect(head.body).toBe("")
    expect(head.ended).toBe(true)
  })

  it("formats an ASCII filename for a non-ASCII slug", async () => {
    mockGetPosts.mockResolvedValue([{ ...samplePost, slug: "안녕-world" }])
    const res = await invoke({ slug: "안녕-world" })
    expect(res.statusCode).toBe(200)
    expect(res.getHeader("content-disposition")).toBe('inline; filename="world.md"')
  })

  it("uses the published registry body while live Notion is unavailable", async () => {
    mockReadContentRecordMap.mockResolvedValue(makeRecordMap())
    mockGetRecordMap.mockRejectedValue(new Error("Notion 502"))
    const res = await invoke({ slug: samplePost.slug, sourceMap: "1" })
    expect(res.statusCode).toBe(200)
    expect(JSON.parse(res.body)).toEqual(expectedDocument)
    expect(mockGetRecordMap).not.toHaveBeenCalled()
  })

  it.each(["GET", "HEAD"])("retains sourceMap on authorized redirects for %s", async method => {
    mockGetSlugRedirect.mockResolvedValue(samplePost.slug)
    const res = await invoke({ slug: "old-slug", sourceMap: "1" }, method)
    expect(res.statusCode).toBe(308)
    expect(res.getHeader("location")).toBe("https://blog.pieroot.xyz/hello-world.md?sourceMap=1")
    expect(res.getHeader("content-length")).toBe(String(Buffer.byteLength("Permanent Redirect\n")))
    expect(res.body).toBe(method === "HEAD" ? "" : "Permanent Redirect\n")
    expect(mockReadContentRecordMap).not.toHaveBeenCalled()
    expect(mockGetRecordMap).not.toHaveBeenCalled()
  })

  it.each([
    ["Private", "Post", "2026-01-01"],
    ["Public", "Post", "2999-01-01"],
    ["Public", "Database", "2026-01-01"],
  ])("denies hidden JSON bodies and redirect targets (%s, %s, %s)", async (status, type, date) => {
    const hidden = { ...samplePost, status: [status], type: [type], date: { start_date: date } } as TPost
    mockGetPosts.mockResolvedValue([hidden])
    mockGetSlugRedirect.mockResolvedValue(samplePost.slug)
    for (const slug of [samplePost.slug, "old-slug"]) {
      for (const method of ["GET", "HEAD"]) {
        const res = await invoke({ slug, sourceMap: "1" }, method)
        expect(res.statusCode).toBe(404)
        expect(res.getHeader("location")).toBeUndefined()
        expect(res.getHeader("cache-control")).toBe("no-store")
        expect(res.body).toBe(method === "HEAD" ? "" : "Not Found\n")
      }
    }
    expect(mockReadContentRecordMap).not.toHaveBeenCalled()
    expect(mockGetRecordMap).not.toHaveBeenCalled()
    expect(mockGetRecordMapDatabases).not.toHaveBeenCalled()
  })

  it.each(["Post", "Paper", "Page"] as const)("allows PublicOnDetail %s JSON exports", async type => {
    mockGetPosts.mockResolvedValue([{ ...samplePost, type: [type], status: ["PublicOnDetail"] }])
    const res = await invoke({ slug: samplePost.slug, sourceMap: "1" })
    expect(res.statusCode).toBe(200)
    expect(JSON.parse(res.body).blocks).toEqual(expectedDocument.blocks)
  })

  it("never resolves internal links through private post metadata", async () => {
    const privateId = "aabbccdd-0000-1111-2222-334455667700"
    mockGetPosts.mockResolvedValue([samplePost, { ...samplePost, id: privateId, slug: "private-secret", status: ["Private"] }])
    const recordMap = makeRecordMap()
    recordMap.block[firstId].value = {
      id: firstId, type: "text", properties: { title: [["Private reference", [["p", privateId]]]] },
    } as Block
    mockGetRecordMap.mockResolvedValue(recordMap)
    const res = await invoke({ slug: samplePost.slug, sourceMap: "1" })
    expect(res.statusCode).toBe(200)
    const document = JSON.parse(res.body)
    expect(document.markdown).toContain("Private reference")
    expect(document.markdown).not.toContain("private-secret")
  })

  it.each([{}, { slug: "" }, { slug: ["a", "b"] }])("rejects malformed slugs before data access (%j)", async query => {
    for (const method of ["GET", "HEAD"]) {
      const res = await invoke({ ...query, sourceMap: "1" }, method)
      expect(res.statusCode).toBe(400)
      expect(res.body).toBe(method === "HEAD" ? "" : "Bad Request\n")
    }
    expect(mockGetPosts).not.toHaveBeenCalled()
  })

  it("returns 404 for an unknown slug", async () => {
    const res = await invoke({ slug: "unknown", sourceMap: "1" })
    expect(res.statusCode).toBe(404)
    expect(res.body).toBe("Not Found\n")
  })

  it.each(["POST", "PUT", "DELETE", "OPTIONS"])("rejects %s without loading content", async method => {
    const res = await invoke({ slug: samplePost.slug, sourceMap: "1" }, method)
    expect(res.statusCode).toBe(405)
    expect(res.getHeader("allow")).toBe("GET, HEAD")
    expect(res.body).toBe("Method Not Allowed\n")
    expect(mockGetPosts).not.toHaveBeenCalled()
  })

  it.each(["missing", "rootless", "exception"])("keeps JSON generation failures private and HEAD bodyless (%s)", async failure => {
    if (failure === "missing") mockGetRecordMap.mockResolvedValue(null as unknown as ExtendedRecordMap)
    if (failure === "rootless") mockGetRecordMap.mockResolvedValue({ ...makeRecordMap(), block: {} })
    if (failure === "exception") mockGetRecordMap.mockRejectedValue(new Error("Secret internal connection failed"))
    const get = await invoke({ slug: samplePost.slug, sourceMap: "1" })
    const head = await invoke({ slug: samplePost.slug, sourceMap: "1" }, "HEAD")
    expect(get.statusCode).toBe(503)
    expect(get.body).toBe("Markdown temporarily unavailable\n")
    expect(get.getHeader("content-type")).toBe("text/plain; charset=utf-8")
    expect(get.getHeader("cache-control")).toBe("no-store")
    expect(get.getHeader("retry-after")).toBe("60")
    expect(head.statusCode).toBe(get.statusCode)
    expect(head.headers).toEqual(get.headers)
    expect(head.body).toBe("")
    expect(errorLog).toHaveBeenCalled()
  })
})
