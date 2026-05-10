/**
 * @jest-environment node
 *
 * SSRF guard + OG parser unit tests for fetchOgMetadata.
 */

import { parseOgFromHtml } from "src/libs/utils/notion/fetchOgMetadata"

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
