import type { NextApiRequest, NextApiResponse } from "next"
import { getPosts, getRecordMap, getRecordMapDatabases } from "src/apis"
import { getSlugRedirect, readContentRecordMap } from "src/libs/content/registry"
import { renderPostMarkdown } from "src/libs/utils/notion/markdown"
import { markdownUrl, postUrl, publicDetails } from "src/libs/seo"
import { CONFIG } from "site.config"
import { errorLog } from "src/libs/utils/logger"

function sendResponse(
  req: NextApiRequest,
  res: NextApiResponse,
  status: number,
  headers: Record<string, string>,
  body: string
) {
  res.statusCode = status
  for (const [key, value] of Object.entries(headers)) {
    res.setHeader(key, value)
  }
  const contentLength = String(Buffer.byteLength(body, "utf8"))
  res.setHeader("Content-Length", contentLength)

  if (req.method === "HEAD") {
    res.end()
  } else {
    res.end(body)
  }
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== "GET" && req.method !== "HEAD") {
    return sendResponse(
      req,
      res,
      405,
      {
        "Content-Type": "text/plain; charset=utf-8",
        "Cache-Control": "no-store",
        Allow: "GET, HEAD",
      },
      "Method Not Allowed\n"
    )
  }

  const { slug } = req.query
  if (!slug || typeof slug !== "string" || Array.isArray(slug)) {
    return sendResponse(
      req,
      res,
      400,
      {
        "Content-Type": "text/plain; charset=utf-8",
        "Cache-Control": "no-store",
      },
      "Bad Request\n"
    )
  }

  try {
    const posts = await getPosts()
    const filteredPosts = publicDetails(posts)
    const post = filteredPosts.find((candidate) => candidate.slug === slug)

    if (!post) {
      const targetSlug = await getSlugRedirect(slug)
      if (targetSlug && targetSlug !== slug) {
        const target = filteredPosts.find((candidate) => candidate.slug === targetSlug)
        if (target) {
          return sendResponse(req, res, 308, {
            "Content-Type": "text/plain; charset=utf-8",
            "Cache-Control": "no-store",
            Location: markdownUrl(target.slug),
          }, "Permanent Redirect\n")
        }
      }
    }

    if (!post) {
      return sendResponse(
        req,
        res,
        404,
        {
          "Content-Type": "text/plain; charset=utf-8",
          "Cache-Control": "no-store",
        },
        "Not Found\n"
      )
    }

    const recordMap = await readContentRecordMap(post.id)
      ?? await getRecordMap(post.id, filteredPosts, { lastEditedTime: post.lastEditedTime })
    if (!recordMap) {
      errorLog(`Missing record map for slug: ${slug}`)
      return sendResponse(
        req,
        res,
        503,
        {
          "Content-Type": "text/plain; charset=utf-8",
          "Cache-Control": "no-store",
          "Retry-After": "60",
        },
        "Markdown temporarily unavailable\n"
      )
    }

    const dbs = await getRecordMapDatabases(recordMap)
    const markdown = renderPostMarkdown(post, recordMap, dbs, {
      siteUrl: CONFIG.link,
      allPosts: filteredPosts,
    })

    const safeSlug =
      post.slug.replace(/[^A-Za-z0-9._-]+/g, "-").replace(/^-+|-+$/g, "") ||
      "page"
    const filename = `${safeSlug}.md`

    return sendResponse(
      req,
      res,
      200,
      {
        "Content-Type": "text/markdown; charset=utf-8",
        "Content-Disposition": `inline; filename="${filename}"`,
        "Cache-Control": "no-store",
        Link: `<${postUrl(post.slug)}>; rel="canonical"`,
      },
      markdown
    )
  } catch (err) {
    errorLog(`Error generating markdown for slug ${slug}:`, err)
    return sendResponse(
      req,
      res,
      503,
      {
        "Content-Type": "text/plain; charset=utf-8",
        "Cache-Control": "no-store",
        "Retry-After": "60",
      },
      "Markdown temporarily unavailable\n"
    )
  }
}
