import { randomUUID } from "crypto"
import type { NextApiRequest, NextApiResponse } from "next"
import { getPosts } from "../../apis"
import type { TPost } from "../../types"
import { getBuiltGraph } from "src/apis/notion-client/getBuiltGraph"
import { getNotionGraph } from "src/apis/notion-client/getNotionGraph"
import { refreshGraphSnapshotInQdrant } from "src/apis/notion-client/graphSnapshot"
import { cacheStore } from "src/libs/cache"
import { getInternalOrigin } from "src/libs/utils/security"
import { verifyRevalidateToken } from "src/libs/utils/auth/verifyToken"

type WarmLabel = "sitemap" | "notion-graph"

type WarmResult = {
  label: WarmLabel
  status: number | null
  ok: boolean
  durationMs: number
}


async function warmPath(
  origin: string,
  path: string,
  label: WarmLabel,
  requestId: string
): Promise<WarmResult> {
  const startedAt = Date.now()
  const url = `${origin}${path}`

  try {
    const response = await fetch(url)
    const result: WarmResult = {
      label,
      status: response.status,
      ok: response.ok,
      durationMs: Date.now() - startedAt,
    }

    if (response.ok) {
      console.info("[revalidate] warm completed", { requestId, url, ...result })
    } else {
      console.warn("[revalidate] warm returned non-2xx", { requestId, url, ...result })
    }

    return result
  } catch (err) {
    console.error("[revalidate] warm failed", {
      requestId,
      label,
      url,
      durationMs: Date.now() - startedAt,
      error: err,
    })
    return {
      label,
      status: null,
      ok: false,
      durationMs: Date.now() - startedAt,
    }
  }
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (!verifyRevalidateToken(req)) {
    return res.status(401).json({ message: "Invalid token" })
  }

  const requestId = randomUUID().slice(0, 8)
  const { path } = req.query

  try {
    if (path && typeof path === "string") {
      await res.revalidate(path)
      console.info("[revalidate] path completed", { requestId, path })
      return res.json({ revalidated: true })
    }

    console.info("[revalidate] accepted", { requestId, mode: "full" })
    res.json({ revalidated: true, status: "processing" })

    setImmediate(async () => {
      const startedAt = Date.now()
      console.info("[revalidate] background started", { requestId })

      try {
        await cacheStore.clear()
        console.info("[revalidate] cache cleared", { requestId })

        const posts = await getPosts({ bypassCache: true })
        const notionGraph = await getNotionGraph({ bypassCache: true })
        const builtGraph = await getBuiltGraph({ bypassCache: true, notionGraph })
        console.info("[revalidate] content prepared", {
          requestId,
          posts: posts.length,
          partialGraph: notionGraph.partial === true,
          nodes: builtGraph.nodes.length,
          edges: builtGraph.edges.length,
        })

        await refreshGraphSnapshotInQdrant({
          posts,
          notionGraph,
          builtGraph,
          bypassCache: true,
        })
        if (notionGraph.partial === true) {
          console.warn("[revalidate] graph snapshot skipped for partial graph", {
            requestId,
          })
        } else {
          console.info("[revalidate] graph snapshot refreshed", { requestId })
        }

        const pathsToRevalidate = [
          "/",
          "/graph",
          ...posts.map((row: TPost) => `/${row.slug}`),
        ]
        await Promise.all(pathsToRevalidate.map((currentPath) => res.revalidate(currentPath)))
        console.info("[revalidate] isr paths revalidated", {
          requestId,
          count: pathsToRevalidate.length,
        })

        const origin = getInternalOrigin()
        const warmResults = await Promise.all([
          warmPath(origin, "/sitemap.xml", "sitemap", requestId),
          warmPath(origin, "/graphs/notion-graph.json", "notion-graph", requestId),
        ])

        console.info("[revalidate] background completed", {
          requestId,
          posts: posts.length,
          partialGraph: notionGraph.partial === true,
          durationMs: Date.now() - startedAt,
          warmResults,
        })
      } catch (err) {
        console.error("[revalidate] background failed", {
          requestId,
          durationMs: Date.now() - startedAt,
          error: err,
        })
      }
    })
  } catch (err) {
    console.error("[revalidate] request failed before background start", {
      requestId,
      error: err,
    })
    return res.status(500).send("Error revalidating")
  }
}
