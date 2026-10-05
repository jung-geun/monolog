import type { NextApiRequest, NextApiResponse } from "next"
import { CONFIG } from "site.config"
import { getPosts } from "src/apis/notion-client/getPosts"
import { absoluteUrl, markdownUrl, publicDetails, summaryText } from "src/libs/seo"
import { errorLog } from "src/libs/utils/logger"

const inlineText = (value: string): string => value.replace(/[\r\n]+/g, " ").trim()
const linkLabel = (value: string): string => inlineText(value).replace(/[\\\[\]]/g, "\\$&")

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  res.setHeader("Cache-Control", "no-store")
  res.setHeader("Content-Type", "text/plain; charset=utf-8")
  if (req.method !== "GET" && req.method !== "HEAD") {
    res.setHeader("Allow", "GET, HEAD")
    return res.status(405).end("Method Not Allowed\n")
  }

  try {
    const posts = publicDetails(await getPosts())
    const links = posts.map((post) => {
      const description = inlineText(summaryText(post.summary))
      return `- [${linkLabel(post.title)}](${markdownUrl(post.slug)})${description ? `: ${description}` : ""}`
    }).join("\n")
    const text = `# ${inlineText(CONFIG.blog.title)}

> ${inlineText(CONFIG.blog.description)}

This optional document helps AI readers discover published content. It is not a replacement for the site's pages, sitemap, or search indexing.

Website: ${absoluteUrl("/")}
Sitemap: ${absoluteUrl("/sitemap.xml")}

## Published content

${links}${links ? "\n" : ""}`
    res.setHeader("Content-Length", Buffer.byteLength(text, "utf8"))
    return res.status(200).end(req.method === "HEAD" ? undefined : text)
  } catch (error) {
    errorLog("Error generating llms.txt:", error)
    res.setHeader("Retry-After", "60")
    const text = "Published content temporarily unavailable\n"
    res.setHeader("Content-Length", Buffer.byteLength(text, "utf8"))
    return res.status(503).end(req.method === "HEAD" ? undefined : text)
  }
}
