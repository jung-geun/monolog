/**
 * @jest-environment node
 */
import type { NextApiRequest, NextApiResponse } from "next"
import type { ExtendedRecordMap } from "notion-types"

const retrieveBlock = jest.fn()
const listChildren = jest.fn()
const retrievePage = jest.fn()
let cached: ExtendedRecordMap | null = null
jest.mock("src/apis/notion-client/notionClient", () => ({
  getOfficialNotionClient: () => ({
    pages: { retrieve: retrievePage },
    blocks: { retrieve: retrieveBlock, children: { list: listChildren } },
  }),
}))
jest.mock("src/libs/content/storage", () => ({ readStoredContent: jest.fn() }))
jest.mock("src/libs/cache", () => ({
  keys: { recordMap: (id: string, edited: string) => `${id}:${edited}` },
  cacheStore: { get: jest.fn(async () => cached), set: jest.fn(async (_key: string, value: ExtendedRecordMap) => { cached = value }) },
}))
jest.mock("site.config", () => ({ CONFIG: { link: "https://blog.example.com", revalidateTime: 3600 } }))
jest.mock("src/libs/utils/logger", () => ({ debugLog: jest.fn() }))

import { getRecordMap } from "src/apis/notion-client/getRecordMap"
import handler from "src/pages/api/attachment"
import { readStoredContent } from "src/libs/content/storage"
import { readContentRecordMap } from "src/libs/content/registry"
import { unwrapBlock } from "src/libs/utils/notion/unwrapBlock"

const PAGE = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa"
const BLOCK = "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb"
const CONTAINER = "cccccccc-cccc-cccc-cccc-cccccccccccc"
const FOREIGN = "dddddddd-dddd-dddd-dddd-dddddddddddd"
const EDITED = "2026-06-01T12:00:00.000Z"
const normalized = (id: string) => id.replace(/-/g, "")
const signed = (signature: string, filename = "report.pdf") =>
  `https://prod-files-secure.s3.us-west-2.amazonaws.com/bucket/${filename}?X-Amz-Signature=${signature}&X-Amz-Expires=60`
type AttachmentType = "file" | "pdf" | "video" | "audio"
function upload(type: AttachmentType = "file", overrides: Record<string, unknown> = {}) {
  return {
    object: "block", id: BLOCK, type, archived: false, in_trash: false, has_children: false,
    parent: { type: "page_id", page_id: PAGE }, created_time: EDITED, last_edited_time: EDITED,
    [type]: { type: "file", file: { url: signed("expired"), expiry_time: EDITED }, name: "report.pdf", caption: [] },
    ...overrides,
  }
}
async function body(blocks = [upload()]): Promise<ExtendedRecordMap> {
  listChildren.mockResolvedValueOnce({ results: blocks, has_more: false })
  const map = await getRecordMap(PAGE, undefined, { bypassCache: true, lastEditedTime: EDITED })
  if (!map) throw new Error("Fixture body not returned")
  return map
}
function publish(map: ExtendedRecordMap) {
  ;(readStoredContent as jest.Mock).mockResolvedValue({
    initialized: true, entries: { [normalized(PAGE)]: { post: { id: PAGE }, recordMap: JSON.parse(JSON.stringify(map)) } },
  })
}
async function request(query: Record<string, string | string[]> = { pageId: PAGE, blockId: BLOCK }, method = "GET") {
  const response = {
    statusCode: 200, headers: {} as Record<string, string>, ended: false,
    setHeader(key: string, value: string) { this.headers[key.toLowerCase()] = value; return this },
    status(code: number) { this.statusCode = code; return this },
    end() { this.ended = true; return this },
  }
  await handler({ method, query } as unknown as NextApiRequest, response as unknown as NextApiResponse)
  return response
}

beforeEach(() => {
  jest.clearAllMocks()
  retrieveBlock.mockReset()
  listChildren.mockReset()
  retrievePage.mockReset()
  ;(readStoredContent as jest.Mock).mockReset()
  cached = null
  retrievePage.mockResolvedValue({
    object: "page", id: PAGE, archived: false, in_trash: false, created_time: EDITED, last_edited_time: EDITED,
    url: `https://www.notion.so/${normalized(PAGE)}`,
    created_by: { id: FOREIGN }, last_edited_by: { id: FOREIGN }, properties: {},
  })
  retrieveBlock.mockResolvedValue(upload("file", { file: { type: "file", file: { url: signed("fresh") } } }))
})

test.each<AttachmentType>(["file", "pdf", "video", "audio"])("an unchanged published %s refreshes expired signed URLs for GET and HEAD", async (type) => {
  const map = await body([upload(type)])
  publish(map)
  const source = unwrapBlock(map.block[BLOCK])?.properties?.source?.[0]?.[0]
  const url = new URL(source!)
  expect(url.origin).toBe("https://blog.example.com")
  expect(url.pathname).toBe("/api/attachment")
  expect(url.searchParams.get("filename")).toBe("report.pdf")
  expect(source).not.toContain("expired")
  if (type === "file") expect(unwrapBlock(map.block[BLOCK])?.properties?.title).toEqual([["report.pdf"]])
  if (type === "audio") expect(unwrapBlock(map.block[BLOCK])?.format?.display_source).toBe(source)
  const before = JSON.stringify(await readContentRecordMap(PAGE))
  for (const [method, signature] of [["GET", "fresh"], ["HEAD", "refreshed-again"]]) {
    retrieveBlock.mockResolvedValueOnce(upload(type, { [type]: { type: "file", file: { url: signed(signature) } } }))
    const res = await request(Object.fromEntries(url.searchParams), method)
    expect(res.statusCode).toBe(307)
    expect(res.headers.location).toBe(signed(signature))
    expect(res.headers["cache-control"]).toBe("no-store")
    expect(res.ended).toBe(true)
  }
  expect(JSON.stringify(await readContentRecordMap(PAGE))).toBe(before)
})

test.each<AttachmentType>(["file", "pdf", "video", "audio"])("external %s remains external, including S3 URLs", async (type) => {
  const external = "https://example.s3.amazonaws.com/media.mp4?X-Amz-Signature=external"
  const map = await body([upload(type, { [type]: { type: "external", external: { url: external }, caption: [] } })])
  expect(unwrapBlock(map.block[BLOCK])?.properties?.source).toEqual([[external]])
})

test("nested attachments use the published page ID and partial descendants never replace its complete cached body", async () => {
  const nested = upload("file", { parent: { type: "block_id", block_id: CONTAINER } })
  const container = { ...upload(), id: CONTAINER, type: "toggle", toggle: { rich_text: [] }, has_children: true }
  listChildren.mockResolvedValueOnce({ results: [container], has_more: false })
  listChildren.mockResolvedValueOnce({ results: [nested], has_more: false })
  const map = await getRecordMap(PAGE, undefined, { bypassCache: true, lastEditedTime: EDITED })
  if (!map) throw new Error("Missing nested body")
  const source = unwrapBlock(map.block[BLOCK])?.properties?.source?.[0]?.[0]
  expect(new URL(source!).searchParams.get("pageId")).toBe(PAGE)
  publish(map)
  retrieveBlock.mockResolvedValueOnce({ ...nested, file: { type: "file", file: { url: signed("fresh") } } })
  expect((await request()).statusCode).toBe(307)
  listChildren.mockResolvedValueOnce({ results: [container], has_more: false })
  listChildren.mockResolvedValueOnce({ results: [{ object: "block", id: BLOCK }], has_more: false })
  await expect(getRecordMap(PAGE, undefined, { bypassCache: true, lastEditedTime: EDITED })).rejects.toThrow("incomplete child blocks")
  expect(await getRecordMap(PAGE, undefined, { lastEditedTime: EDITED })).toEqual(map)
})

test("private pages, foreign IDs and detached or removed blocks are not authorized by integration access", async () => {
  const map = await body()
  publish(map)
  expect((await request({ pageId: FOREIGN, blockId: BLOCK })).statusCode).toBe(404)
  expect((await request({ pageId: PAGE, blockId: FOREIGN })).statusCode).toBe(404)
  const root = unwrapBlock(map.block[PAGE])!
  root.content = []
  publish(map)
  expect((await request()).statusCode).toBe(404)
  ;(readStoredContent as jest.Mock).mockResolvedValue({ initialized: true, entries: {} })
  expect((await request()).statusCode).toBe(404)
  expect(retrieveBlock).not.toHaveBeenCalled()
})

test("non-attachment published blocks never reveal an integration file", async () => {
  const map = await body()
  unwrapBlock(map.block[BLOCK])!.type = "image"
  publish(map)
  expect((await request()).statusCode).toBe(404)
  expect(retrieveBlock).not.toHaveBeenCalled()
})

test.each([
  { archived: true }, { in_trash: true },
  { type: "image" }, { parent: { type: "page_id", page_id: FOREIGN } },
  { file: { type: "external", external: { url: "https://example.com/file" } } },
])("rejects an attachment that is no longer a live official upload: %j", async (change) => {
  publish(await body())
  retrieveBlock.mockResolvedValueOnce(upload("file", change))
  const res = await request()
  expect(res.statusCode).toBe(404)
  expect(res.headers.location).toBeUndefined()
})

const authenticatedTarget = new URL("https://secure.notion-static.com/file.pdf")
authenticatedTarget.username = "example-user"
authenticatedTarget.password = "example-password"

test.each([
  "http://prod-files-secure.s3.us-west-2.amazonaws.com/file.pdf",
  "https://prod-files-secure.s3.us-west-2.amazonaws.com.evil.test/file.pdf",
  "https://unrelated.s3.amazonaws.com/file.pdf",
  authenticatedTarget.toString(),
])("fails closed for an untrusted redirect target: %s", async (url) => {
  publish(await body())
  retrieveBlock.mockResolvedValueOnce(upload("file", { file: { type: "file", file: { url } } }))
  const res = await request()
  expect(res.statusCode).toBe(503)
  expect(res.headers.location).toBeUndefined()
  expect(res.headers["cache-control"]).toBe("no-store")
})

test("upstream outages and partial SDK responses fail 503 without mutating the published body", async () => {
  publish(await body())
  const before = JSON.stringify(await readContentRecordMap(PAGE))
  retrieveBlock.mockRejectedValueOnce(new Error("Notion unavailable"))
  expect((await request()).statusCode).toBe(503)
  retrieveBlock.mockResolvedValueOnce({ object: "block", id: BLOCK })
  expect((await request()).statusCode).toBe(503)
  expect(JSON.stringify(await readContentRecordMap(PAGE))).toBe(before)
  retrieveBlock.mockRejectedValueOnce({ code: "object_not_found" })
  expect((await request()).statusCode).toBe(404)
})
