/**
 * @jest-environment node
 */

import type { NextApiRequest, NextApiResponse } from "next"
import imageProxy from "src/pages/api/image-proxy"

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
})
