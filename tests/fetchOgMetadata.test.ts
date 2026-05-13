/**
 * @jest-environment node
 *
 * SSRF guard + OG parser unit tests for fetchOgMetadata.
 */

import { parseOgFromHtml, getOgMetadata } from "src/libs/utils/notion/fetchOgMetadata"

describe("parseOgFromHtml", () => {
  const base = new URL("https://example.com/article/42")

  it("extracts og:title, og:description, og:image", () => {
    const html = `
      <html><head>
        <meta property="og:title" content="Hello World">
        <meta property="og:description" content="A short summary.">
        <meta property="og:image" content="/cover.png">
        <meta property="og:site_name" content="Example">
      </head><body></body></html>
    `
    const r = parseOgFromHtml(html, base)
    expect(r.title).toBe("Hello World")
    expect(r.description).toBe("A short summary.")
    expect(r.image).toBe("https://example.com/cover.png")
    expect(r.siteName).toBe("Example")
  })

  it("falls back to twitter:* tags then <title> and <meta name=description>", () => {
    const html = `
      <html><head>
        <title>Page Title Fallback</title>
        <meta name="description" content="meta-name desc">
        <meta name="twitter:title" content="Tweeted Title">
        <meta name="twitter:image" content="https://cdn.example.com/x.jpg">
      </head></html>
    `
    const r = parseOgFromHtml(html, base)
    expect(r.title).toBe("Tweeted Title")
    expect(r.description).toBe("meta-name desc")
    expect(r.image).toBe("https://cdn.example.com/x.jpg")
  })

  it("uses <title> when neither og:title nor twitter:title is present", () => {
    const html = "<html><head><title>Bare Title</title></head></html>"
    expect(parseOgFromHtml(html, base).title).toBe("Bare Title")
  })

  it("decodes common HTML entities in extracted text", () => {
    const html = `<meta property="og:title" content="A &amp; B &#39;C&#39;">`
    expect(parseOgFromHtml(html, base).title).toBe("A & B 'C'")
  })

  it("falls back to /favicon.ico when no <link rel='icon'> is present", () => {
    expect(parseOgFromHtml("<html></html>", base).icon).toBe(
      "https://example.com/favicon.ico"
    )
  })

  it("resolves <link rel='icon'> hrefs against the base URL", () => {
    const html = `<link rel="icon" href="/static/favicon-32.png">`
    expect(parseOgFromHtml(html, base).icon).toBe(
      "https://example.com/static/favicon-32.png"
    )
  })

  it("tolerates attribute order swap (content first)", () => {
    const html = `<meta content="Order Swapped" property="og:title">`
    expect(parseOgFromHtml(html, base).title).toBe("Order Swapped")
  })
})

// ---------------------------------------------------------------------------
// getOgMetadata — redirect-following integration tests
// ---------------------------------------------------------------------------

const HTML_WITH_OG = `
<html><head>
  <meta property="og:title" content="Test Page">
  <meta property="og:description" content="A description">
</head></html>
`

function makeResponse(status: number, headers: Record<string, string> = {}, body = ""): Response {
  return new Response(body, { status, headers })
}

function makeHtmlResponse(html = HTML_WITH_OG): Response {
  return new Response(html, {
    status: 200,
    headers: { "content-type": "text/html; charset=utf-8" },
  })
}

jest.mock("src/libs/cache", () => ({
  cacheStore: {
    getOrSet: (_key: string, _ttl: number, fetcher: () => Promise<unknown>) => fetcher(),
    set: jest.fn(),
    get: jest.fn().mockResolvedValue(null),
  },
  keys: { og: (url: string) => `og:test:${url}` },
}))

jest.mock("dns", () => ({
  promises: {
    lookup: jest.fn().mockResolvedValue([{ address: "93.184.216.34", family: 4 }]),
  },
}))

describe("getOgMetadata — redirect handling", () => {
  let fetchMock: jest.Mock

  beforeEach(() => {
    fetchMock = jest.fn()
    global.fetch = fetchMock
  })

  afterEach(() => {
    jest.clearAllMocks()
  })

  it("follows a single redirect and returns metadata", async () => {
    fetchMock
      .mockResolvedValueOnce(
        makeResponse(302, { Location: "https://example.com/final" })
      )
      .mockResolvedValueOnce(makeHtmlResponse())

    const result = await getOgMetadata("http://example.com/start")
    expect(result?.title).toBe("Test Page")
    expect(fetchMock).toHaveBeenCalledTimes(2)
  })

  it("returns null when redirect chain exceeds MAX_REDIRECT_HOPS", async () => {
    fetchMock.mockResolvedValue(
      makeResponse(302, { Location: "https://example.com/loop" })
    )

    const result = await getOgMetadata("https://example.com/loop")
    expect(result).toBeNull()
    // MAX_REDIRECT_HOPS = 3 → loop runs for hops 0..3 = 4 fetch calls
    expect(fetchMock).toHaveBeenCalledTimes(4)
  })

  it("returns null when redirect Location header is missing", async () => {
    fetchMock.mockResolvedValueOnce(makeResponse(302))

    const result = await getOgMetadata("https://example.com/")
    expect(result).toBeNull()
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it("blocks redirect to private IP (SSRF guard)", async () => {
    const dns = await import("dns")
    const lookupMock = dns.promises.lookup as jest.Mock
    // First call (initial URL) resolves to public IP; second (redirect target) to private.
    lookupMock
      .mockResolvedValueOnce([{ address: "93.184.216.34", family: 4 }])
      .mockResolvedValueOnce([{ address: "10.0.0.1", family: 4 }])

    fetchMock.mockResolvedValueOnce(
      makeResponse(302, { Location: "http://internal.corp/secret" })
    )

    const result = await getOgMetadata("https://example.com/")
    expect(result).toBeNull()
    // Second fetch should never be reached because SSRF guard fires first
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it("resolves relative Location against the current URL", async () => {
    fetchMock
      .mockResolvedValueOnce(makeResponse(302, { Location: "/redirected" }))
      .mockResolvedValueOnce(makeHtmlResponse())

    const result = await getOgMetadata("https://example.com/start")
    expect(result?.title).toBe("Test Page")
    const secondCall = fetchMock.mock.calls[1][0] as string
    expect(secondCall).toBe("https://example.com/redirected")
  })
})
