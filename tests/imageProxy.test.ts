/**
 * @jest-environment node
 */

import type { NextApiRequest, NextApiResponse } from "next"
import imageProxy from "src/pages/api/image-proxy"

jest.mock("src/libs/cache/imageBlobCache", () => ({
  ...jest.requireActual("src/libs/cache/imageBlobCache"),
  imageBlobCache: {
    get: jest.fn().mockResolvedValue(null),
    set: jest.fn().mockResolvedValue(undefined),
  },
}))
jest.mock("src/libs/utils/image/proxyServer", () => ({
  ...jest.requireActual("src/libs/utils/image/proxyServer"),
  appendJsonLog: jest.fn(),
}))

const GITHUB_OG_IMAGE =
  "https://opengraph.githubassets.com/05c51e339593d0a1d70e7404fa73e66d25a5ab1bdd7b97d8ee6668ebb48881da/jung-geun/PSO"

const response = () => {
  const res = {
    json: jest.fn(),
    send: jest.fn(),
    setHeader: jest.fn(),
    status: jest.fn(),
  }
  res.status.mockReturnValue(res)
  return res as unknown as NextApiResponse
}

const request = (url: string): NextApiRequest =>
  ({
    headers: {},
    query: { url },
    socket: { remoteAddress: "203.0.113.1" },
    url: `/api/image-proxy?url=${encodeURIComponent(url)}`,
  }) as unknown as NextApiRequest

describe("image proxy GitHub Open Graph thumbnails", () => {
  const originalFetch = global.fetch
  const originalCommentHashSalt = process.env.COMMENT_HASH_SALT

  beforeAll(() => {
    process.env.COMMENT_HASH_SALT = "image-proxy-test-salt"
  })

  afterAll(() => {
    if (originalCommentHashSalt === undefined) {
      delete process.env.COMMENT_HASH_SALT
    } else {
      process.env.COMMENT_HASH_SALT = originalCommentHashSalt
    }
  })

  afterEach(() => {
    global.fetch = originalFetch
    jest.restoreAllMocks()
  })

  it("proxies GitHub's Open Graph cover image instead of returning an unavailable placeholder", async () => {
    const image = Buffer.from("github-og-image")
    global.fetch = jest.fn().mockResolvedValue(
      new Response(image, {
        headers: {
          "content-length": String(image.length),
          "content-type": "image/webp",
        },
      })
    )
    const res = response()

    await imageProxy(request(GITHUB_OG_IMAGE), res)

    expect(global.fetch).toHaveBeenCalledWith(
      GITHUB_OG_IMAGE,
      expect.objectContaining({ redirect: "manual" })
    )
    expect(res.setHeader).toHaveBeenCalledWith("Content-Type", "image/webp")
    expect(res.send).toHaveBeenCalledWith(image)
  })

  it("keeps arbitrary external image hosts blocked", async () => {
    const fetchMock = jest.fn()
    global.fetch = fetchMock
    const res = response()

    await imageProxy(request("https://example.com/image.webp"), res)

    expect(fetchMock).not.toHaveBeenCalled()
    expect(res.status).toHaveBeenCalledWith(403)
    expect(res.json).toHaveBeenCalledWith({ error: "Host not allowed" })
  })

  it("returns an optimizer-compatible PNG when a stable Notion image is unavailable", async () => {
    const req = {
      headers: {},
      query: { kind: "s3", id: "missing-stable-image" },
      socket: { remoteAddress: "203.0.113.1" },
      url: "/api/image-proxy?kind=s3&id=missing-stable-image",
    } as unknown as NextApiRequest
    const res = response()

    await imageProxy(req, res)

    expect(res.setHeader).toHaveBeenCalledWith("Content-Type", "image/png")
    expect(res.status).toHaveBeenCalledWith(200)
    const body = (res.send as jest.Mock).mock.calls[0][0]
    expect(Buffer.isBuffer(body)).toBe(true)
    expect(body.subarray(0, 8)).toEqual(
      Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])
    )
  })

  it("serves a 12 MiB Notion thumbnail instead of a transparent placeholder", async () => {
    const image = Buffer.alloc(12 * 1024 * 1024, 0x7a)
    global.fetch = jest.fn().mockResolvedValue(new Response(image, {
      headers: { "content-length": String(image.byteLength), "content-type": "image/webp" },
    }))
    const res = response()

    await imageProxy(request("https://prod-files-secure.s3.us-west-2.amazonaws.com/large-thumbnail.webp"), res)

    expect(res.setHeader).toHaveBeenCalledWith("Content-Type", "image/webp")
    const body: unknown = jest.mocked(res.send).mock.calls[0]?.[0]
    expect(Buffer.isBuffer(body)).toBe(true)
    if (!Buffer.isBuffer(body)) throw new Error("Expected an image buffer")
    expect(body.byteLength).toBe(image.byteLength)
  })

  it("rejects an announced 17 MiB image before consuming its body", async () => {
    const upstream = new Response("unread image body", {
      headers: { "content-length": String(17 * 1024 * 1024), "content-type": "image/webp" },
    })
    global.fetch = jest.fn().mockResolvedValue(upstream)
    const res = response()

    await imageProxy(request("https://prod-files-secure.s3.us-west-2.amazonaws.com/oversized-thumbnail.webp"), res)

    expect(upstream.bodyUsed).toBe(false)
    expect(res.setHeader).toHaveBeenCalledWith("Content-Type", "image/png")
  })

  it("cancels a 17 MiB streamed image even without a content length", async () => {
    const cancel = jest.fn()
    const upstream = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(new Uint8Array(9 * 1024 * 1024))
        controller.enqueue(new Uint8Array(8 * 1024 * 1024))
      },
      cancel,
    })
    global.fetch = jest.fn().mockResolvedValue(new Response(upstream, {
      headers: { "content-type": "image/webp" },
    }))
    const res = response()

    await imageProxy(request("https://prod-files-secure.s3.us-west-2.amazonaws.com/streamed-thumbnail.webp"), res)

    expect(cancel).toHaveBeenCalledWith("Image too large")
    expect(res.setHeader).toHaveBeenCalledWith("Content-Type", "image/png")
  })
})
