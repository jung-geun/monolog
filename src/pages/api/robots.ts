import type { NextApiRequest, NextApiResponse } from "next"
import { absoluteUrl } from "src/libs/seo"
import { errorLog } from "src/libs/utils/logger"

export default function handler(req: NextApiRequest, res: NextApiResponse) {
  res.setHeader("Cache-Control", "no-store")
  res.setHeader("Content-Type", "text/plain; charset=utf-8")
  if (req.method !== "GET" && req.method !== "HEAD") {
    res.setHeader("Allow", "GET, HEAD")
    return res.status(405).end("Method Not Allowed\n")
  }

  try {
    // The only robots policy; site URLs follow NEXT_PUBLIC_SITE_URL.
    const text = `# *
User-agent: *
Allow: /

# Host
Host: ${absoluteUrl("/").replace(/\/$/, "")}

# Sitemaps
Sitemap: ${absoluteUrl("/sitemap.xml")}
RSS: ${absoluteUrl("/rss.xml")}
`
    res.setHeader("Content-Length", Buffer.byteLength(text, "utf8"))
    return res.status(200).end(req.method === "HEAD" ? undefined : text)
  } catch (error) {
    errorLog("Error generating robots.txt:", error)
    res.setHeader("Retry-After", "60")
    const text = "Robots policy temporarily unavailable\n"
    res.setHeader("Content-Length", Buffer.byteLength(text, "utf8"))
    return res.status(503).end(req.method === "HEAD" ? undefined : text)
  }
}
