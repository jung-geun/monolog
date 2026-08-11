import type { NextApiRequest, NextApiResponse } from "next"
import { getPosts, getPostBySlug, getRecordMap, getRecordMapDatabases } from "src/apis"
import { renderPostMarkdown } from "src/libs/utils/notion/markdown"
import { filterPosts } from "src/libs/utils/notion"
import type { FilterPostsOptions } from "src/libs/utils/notion/filterPosts"
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
    const filterOptions: FilterPostsOptions = {
      acceptStatus: ["Public", "PublicOnDetail"],
      acceptType: ["Paper", "Post", "Page"],
    }

    const posts = await getPosts()
    const filteredPosts = filterPosts(posts, filterOptions)
    let post = filteredPosts.find((p) => p.slug === slug)

    if (!post) {
      const fallbackPost = await getPostBySlug(slug)
      if (fallbackPost) {
        const filteredFallback = filterPosts([fallbackPost], filterOptions)
        if (filteredFallback.length > 0) {
          post = filteredFallback[0]
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

    const recordMap = await getRecordMap(post.id, posts)
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
      allPosts: posts,
    })

    const safeSlug =
      post.slug.replace(/[^A-Za-z0-9._-]+/g, "-").replace(/^-+|-+$/g, "") ||
      "page"
    const filename = `${safeSlug}.md`
    const sMax = CONFIG.revalidateTime || 21600
    const stale = Math.floor(sMax / 6)

    return sendResponse(
      req,
      res,
      200,
      {
        "Content-Type": "text/markdown; charset=utf-8",
        "Content-Disposition": `inline; filename="${filename}"`,
        "Cache-Control": `public, s-maxage=${sMax}, stale-while-revalidate=${stale}`,
        Link: `<${CONFIG.link}/${post.slug}>; rel="canonical"`,
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
