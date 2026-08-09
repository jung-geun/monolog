/**
 * @jest-environment node
 */

import type { NextApiRequest } from "next"
import { getRequestIp } from "src/libs/utils/image/proxyServer"
import { getIp } from "src/libs/utils/security"

const REMOTE_ADDRESS = "172.18.0.2"
const originalHops = process.env.TRUSTED_PROXY_HOPS
const originalSecret = process.env.TRUSTED_PROXY_SECRET

function request(headers: Record<string, string> = {}, remoteAddress = REMOTE_ADDRESS): NextApiRequest {
  return {
    headers,
    socket: { remoteAddress },
  } as NextApiRequest
}

function setProxyConfig(hops: string | undefined, secret: string | undefined): void {
  if (hops === undefined) delete process.env.TRUSTED_PROXY_HOPS
  else process.env.TRUSTED_PROXY_HOPS = hops

  if (secret === undefined) delete process.env.TRUSTED_PROXY_SECRET
  else process.env.TRUSTED_PROXY_SECRET = secret
}

afterEach(() => {
  setProxyConfig(originalHops, originalSecret)
})

describe("getIp", () => {
  it("ignores spoofed X-Forwarded-For when proxy trust is disabled", () => {
    setProxyConfig("0", "proxy-secret")

    expect(getIp(request({ "x-forwarded-for": "198.51.100.10", "x-monolog-proxy-secret": "proxy-secret" }))).toBe(REMOTE_ADDRESS)
  })

  it.each([
    ["missing proxy secret", {}],
    ["wrong proxy secret", { "x-monolog-proxy-secret": "wrong-secret" }],
  ])("ignores X-Forwarded-For with a %s", (_case, headers) => {
    setProxyConfig("1", "proxy-secret")

    expect(getIp(request({ "x-forwarded-for": "198.51.100.10", ...headers }))).toBe(REMOTE_ADDRESS)
  })

  it("selects the sole client address behind one authenticated proxy hop", () => {
    setProxyConfig("1", "proxy-secret")

    expect(getIp(request({ "x-forwarded-for": "198.51.100.10", "x-monolog-proxy-secret": "proxy-secret" }))).toBe("198.51.100.10")
  })

  it("selects HAProxy's appended client address behind one authenticated proxy hop", () => {
    setProxyConfig("1", "proxy-secret")

    expect(getIp(request({ "x-forwarded-for": "203.0.113.99, 198.51.100.10", "x-monolog-proxy-secret": "proxy-secret" }))).toBe("198.51.100.10")
  })

  it("selects the left client address behind two authenticated proxy hops", () => {
    setProxyConfig("2", "proxy-secret")

    expect(getIp(request({ "x-forwarded-for": "198.51.100.10, 192.0.2.2", "x-monolog-proxy-secret": "proxy-secret" }))).toBe("198.51.100.10")
  })

  it.each([
    ["insufficient forwarded addresses", "2", "198.51.100.10"],
    ["an invalid selected address", "1", "not-an-ip"],
    ["an invalid hop count", "one", "198.51.100.10"],
  ])("falls back to the socket address for %s", (_case, hops, forwarded) => {
    setProxyConfig(hops, "proxy-secret")

    expect(getIp(request({ "x-forwarded-for": forwarded, "x-monolog-proxy-secret": "proxy-secret" }))).toBe(REMOTE_ADDRESS)
  })

  it("uses the same authenticated client identity for image proxy logs", () => {
    setProxyConfig("1", "proxy-secret")
    const req = request({ "x-forwarded-for": "198.51.100.10", "x-monolog-proxy-secret": "proxy-secret" })

    expect(getRequestIp(req)).toBe(getIp(req))
  })
})
