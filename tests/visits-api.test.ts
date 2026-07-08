/**
 * @jest-environment node
 */

jest.mock("src/apis/notion-client/visits", () => ({
  trackUniqueVisit: jest.fn(),
}))

jest.mock("src/apis/notion-client/getPosts", () => ({
  getPosts: jest.fn(),
}))

jest.mock("src/libs/utils/security", () => ({
  getIp: jest.fn(),
  isRequestOriginAllowed: jest.fn(),
}))

jest.mock("src/libs/utils/visits/rateLimit", () => ({
  checkVisitRateLimit: jest.fn(),
}))

import type { NextApiRequest, NextApiResponse } from "next"
import handler from "src/pages/api/visits"
import { getPosts } from "src/apis/notion-client/getPosts"
import { trackUniqueVisit } from "src/apis/notion-client/visits"
import { getIp, isRequestOriginAllowed } from "src/libs/utils/security"
import { checkVisitRateLimit } from "src/libs/utils/visits/rateLimit"

interface RequestStub {
  method?: string
  headers: Record<string, string | undefined>
  body?: unknown
  query: Record<string, string | string[] | undefined>
  socket: { remoteAddress?: string }
  cookies?: Record<string, string>
}

interface ResponseStub {
  statusCode: number
  headers: Record<string, string | string[] | undefined>
  body: unknown
  ended: boolean
  status: (code: number) => ResponseStub
  json: (payload: unknown) => ResponseStub
  setHeader: (name: string, value: string | string[]) => void
  getHeader: (name: string) => string | string[] | undefined
  end: () => ResponseStub
}

const basePost = {
  id: "page-1",
  date: { start_date: "2026-01-01" },
  type: ["Post"] as const,
  slug: "hello",
  title: "Hello",
  status: ["Public"] as const,
  createdTime: "2026-01-01T00:00:00.000Z",
  fullWidth: false,
}

function createReq(overrides: Partial<RequestStub> = {}): RequestStub {
  return {
    method: "POST",
    headers: { origin: "https://example.com" },
    body: { slug: "hello", postId: "page-1" },
    query: {},
    socket: { remoteAddress: "127.0.0.1" },
    ...overrides,
  }
}

function createRes(): ResponseStub {
  const headers: Record<string, string | string[] | undefined> = {}

  const res: ResponseStub = {
    statusCode: 200,
    headers,
    body: undefined,
    ended: false,
    status(code) {
      this.statusCode = code
      return this
    },
    json(payload) {
      this.body = payload
      return this
    },
    setHeader(name, value) {
      headers[name.toLowerCase()] = value
    },
    getHeader(name) {
      return headers[name.toLowerCase()]
    },
    end() {
      this.ended = true
      return this
    },
  }

  return res
}

async function invoke(req: RequestStub, res: ResponseStub): Promise<void> {
  await handler(req as unknown as NextApiRequest, res as unknown as NextApiResponse)
}

describe("/api/visits", () => {
  let previousVisitorHashSalt: string | undefined
  let previousCommentHashSalt: string | undefined

  beforeEach(() => {
    jest.clearAllMocks()

    previousVisitorHashSalt = process.env.VISITOR_HASH_SALT
    previousCommentHashSalt = process.env.COMMENT_HASH_SALT
    process.env.VISITOR_HASH_SALT = "visit-salt"
    delete process.env.COMMENT_HASH_SALT

    ;(isRequestOriginAllowed as jest.Mock).mockReturnValue(true)
    ;(getIp as jest.Mock).mockReturnValue("127.0.0.1")
    ;(checkVisitRateLimit as jest.Mock).mockReturnValue({ ok: true })
    ;(getPosts as jest.Mock).mockResolvedValue([{ ...basePost }])
    ;(trackUniqueVisit as jest.Mock).mockResolvedValue({ counted: true, count: 1 })
  })

  afterEach(() => {
    if (previousVisitorHashSalt === undefined) {
      delete process.env.VISITOR_HASH_SALT
    } else {
      process.env.VISITOR_HASH_SALT = previousVisitorHashSalt
    }

    if (previousCommentHashSalt === undefined) {
      delete process.env.COMMENT_HASH_SALT
    } else {
      process.env.COMMENT_HASH_SALT = previousCommentHashSalt
    }
  })

  it("returns 405 for non-POST requests", async () => {
    const req = createReq({ method: "GET" })
    const res = createRes()

    await invoke(req, res)

    expect(res.statusCode).toBe(405)
    expect(res.body).toEqual({ error: "method not allowed" })
  })

  it("returns 400 for an invalid request body", async () => {
    const req = createReq({ body: { slug: "", postId: "page-1" } })
    const res = createRes()

    await invoke(req, res)

    expect(res.statusCode).toBe(400)
    expect(res.body).toEqual({ error: "invalid request" })
  })

  it("returns 400 when the slug is unknown", async () => {
    ;(getPosts as jest.Mock).mockResolvedValue([])
    const req = createReq()
    const res = createRes()

    await invoke(req, res)

    expect(res.statusCode).toBe(400)
    expect(res.body).toEqual({ error: "invalid request" })
  })

  it("returns 400 when the request postId does not match the canonical post", async () => {
    const req = createReq({ body: { slug: "hello", postId: "client-post" } })
    const res = createRes()

    await invoke(req, res)

    expect(res.statusCode).toBe(400)
    expect(res.body).toEqual({ error: "invalid request" })
  })

  it("returns 403 for a disallowed production origin", async () => {
    ;(isRequestOriginAllowed as jest.Mock).mockReturnValue(false)
    const req = createReq({ headers: { origin: "https://evil.example" } })
    const res = createRes()

    await invoke(req, res)

    expect(res.statusCode).toBe(403)
    expect(res.body).toEqual({ error: "forbidden" })
  })

  it("returns 429 when the visit limiter rejects the request", async () => {
    ;(checkVisitRateLimit as jest.Mock).mockReturnValue({ ok: false })
    const req = createReq()
    const res = createRes()

    await invoke(req, res)

    expect(res.statusCode).toBe(429)
    expect(res.body).toEqual({ error: "too many requests" })
  })

  it("sets the visitor cookie and tracks the visit with the canonical post id", async () => {
    const req = createReq()
    const res = createRes()

    await invoke(req, res)

    expect(res.statusCode).toBe(200)
    expect(res.body).toEqual({ counted: true, count: 1 })

    const setCookieHeader = res.getHeader("Set-Cookie")
    const cookieValues = Array.isArray(setCookieHeader) ? setCookieHeader : [String(setCookieHeader)]

    expect(cookieValues.join("; ")).toContain("monolog_visitor_id=")
    expect(trackUniqueVisit).toHaveBeenCalledWith({
      slug: "hello",
      postId: "page-1",
      visitorId: expect.any(String),
    })
  })

  it("does not require COMMENT_HASH_SALT when visitor env is configured", async () => {
    delete process.env.COMMENT_HASH_SALT
    const req = createReq()
    const res = createRes()

    await invoke(req, res)

    expect(res.statusCode).toBe(200)
    expect(trackUniqueVisit).toHaveBeenCalledWith({
      slug: "hello",
      postId: "page-1",
      visitorId: expect.any(String),
    })
  })
})
