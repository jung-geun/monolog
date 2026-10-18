/**
 * @jest-environment node
 */
import type { NextApiRequest, NextApiResponse } from "next"
import handler from "src/pages/api/ip"

const originalHops = process.env.TRUSTED_PROXY_HOPS
const originalSecret = process.env.TRUSTED_PROXY_SECRET

const invoke = (address: string | undefined, headers: Record<string, string> = {}, method = "GET") => {
  const responseHeaders: Record<string, string> = {}
  let status = 0
  let body: unknown
  const res = {
    setHeader: (name: string, value: string) => { responseHeaders[name] = value },
    status: (code: number) => { status = code; return res },
    json: (value: unknown) => { body = value; return res },
  }
  handler({ method, headers, socket: { remoteAddress: address } } as NextApiRequest, res as unknown as NextApiResponse)
  return { status, body, headers: responseHeaders }
}

afterEach(() => {
  if (originalHops === undefined) delete process.env.TRUSTED_PROXY_HOPS
  else process.env.TRUSTED_PROXY_HOPS = originalHops
  if (originalSecret === undefined) delete process.env.TRUSTED_PROXY_SECRET
  else process.env.TRUSTED_PROXY_SECRET = originalSecret
})

it("keeps authenticated viewer addresses request-local and forbids shared caches", () => {
  process.env.TRUSTED_PROXY_HOPS = "1"
  process.env.TRUSTED_PROXY_SECRET = "test-proxy-secret"
  const first = invoke("172.18.0.2", { "x-monolog-proxy-secret": "test-proxy-secret", "x-forwarded-for": "203.0.113.99, 198.51.100.10" })
  const second = invoke("172.18.0.2", { "x-monolog-proxy-secret": "test-proxy-secret", "x-forwarded-for": "198.51.100.11" })
  expect(first.body).toEqual({ ip: "198.51.100.10" })
  expect(second.body).toEqual({ ip: "198.51.100.11" })
  expect(first.headers["Cache-Control"]).toMatch(/private.*no-store/)
  expect(second.headers["Cache-Control"]).toMatch(/private.*no-store/)
})

it.each([
  ["::ffff:192.0.2.14", "192.0.2.14"],
  ["2001:db8::1234", "2001:db8::1234"],
])("preserves the usable visitor address for %s", (address, ip) => {
  process.env.TRUSTED_PROXY_HOPS = "0"
  expect(invoke(address)).toMatchObject({ status: 200, body: { ip } })
})

it("reports an unavailable address rather than inventing a connection", () => {
  process.env.TRUSTED_PROXY_HOPS = "0"
  expect(invoke(undefined)).toMatchObject({ status: 503, body: { error: "Client address unavailable" } })
})

it("rejects unsupported methods without returning the viewer address", () => {
  expect(invoke("192.0.2.14", {}, "POST")).toMatchObject({ status: 405, headers: { Allow: "GET" }, body: { error: "Method not allowed" } })
})
