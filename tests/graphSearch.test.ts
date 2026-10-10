/**
 * @jest-environment node
 */
import type { NextApiRequest, NextApiResponse } from "next"

jest.mock("src/apis/llm/embeddingGemma", () => ({
  embedQuery: jest.fn(), isEmbeddingConfigured: () => true,
}))
jest.mock("src/apis/vector/qdrantClient", () => ({ searchSimilar: jest.fn(async () => []) }))

import handler from "src/pages/api/graph/search"
import { embedQuery } from "src/apis/llm/embeddingGemma"

let nextIp = 1
const request = (ip = `10.0.0.${nextIp++}`) => ({
  method: "GET", query: { q: "storage recovery" }, headers: {}, socket: { remoteAddress: ip },
}) as unknown as NextApiRequest
const response = () => {
  const headers: Record<string, string | number> = {}
  const res = {
    statusCode: 200, headers,
    setHeader: (key: string, value: string | number) => { headers[key] = value },
    status(code: number) { this.statusCode = code; return this },
    json(_body: unknown) { return this },
    end() { return this },
  }
  return res as unknown as NextApiResponse & { headers: typeof headers }
}

beforeEach(() => {
  process.env.QDRANT_URL = "http://qdrant.test"
  jest.mocked(embedQuery).mockReset().mockResolvedValue([1])
})
afterEach(() => { jest.restoreAllMocks() })

describe("semantic search admission", () => {
  it("rejects a concurrent search without waiting and admits work after completion", async () => {
    const deferred = Promise.withResolvers<number[]>()
    jest.mocked(embedQuery).mockImplementationOnce(() => deferred.promise)
    const first = response()
    const active = handler(request(), first)
    const overlapping = response()
    try {
      await handler(request(), overlapping)
      expect(overlapping.statusCode).toBe(429)
      expect(Number(overlapping.headers["Retry-After"])).toBeGreaterThan(0)
    } finally { deferred.resolve([1]) }
    await active
    const next = response()
    await handler(request(), next)
    expect(first.statusCode).toBe(200)
    expect(next.statusCode).toBe(200)
  })

  it("releases admission after an inference failure", async () => {
    jest.spyOn(console, "error").mockImplementation(() => {})
    jest.mocked(embedQuery).mockRejectedValueOnce(new Error("dependency timeout"))
    const failed = response()
    await handler(request(), failed)
    const recovered = response()
    await handler(request(), recovered)
    expect(failed.statusCode).toBe(503)
    expect(recovered.statusCode).toBe(200)
  })

  it("limits each client window independently and admits the boundary after expiry", async () => {
    let now = Date.now()
    jest.spyOn(Date, "now").mockImplementation(() => now)
    const req = request()
    for (let i = 0; i < 6; i++) {
      const admitted = response()
      await handler(req, admitted)
      expect(admitted.statusCode).toBe(200)
    }
    const limited = response()
    await handler(req, limited)
    const otherClient = response()
    await handler(request(), otherClient)
    now += 60_000
    const expired = response()
    await handler(req, expired)
    expect(limited.statusCode).toBe(429)
    expect(Number(limited.headers["Retry-After"])).toBeGreaterThan(0)
    expect(otherClient.statusCode).toBe(200)
    expect(expired.statusCode).toBe(200)
  })
})
