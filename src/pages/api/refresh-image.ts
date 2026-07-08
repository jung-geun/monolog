import { NextApiRequest, NextApiResponse } from "next"
import { getOfficialNotionClient } from "src/apis/notion-client/notionClient"
import {
  checkRefreshImageRateLimit,
  getIpHash,
  isRequestOriginAllowed,
  isValidNotionId,
  normalizeNotionId,
} from "src/libs/utils/security"
import { CONFIG } from "site.config"

const NOTION_TIMEOUT_MS = 8_000

function withTimeout<T>(p: Promise<T>, ms: number): Promise<T> {
  return Promise.race([
    p,
    new Promise<T>((_, reject) =>
      setTimeout(() => reject(new Error(`Notion request timed out after ${ms}ms`)), ms)
    ),
  ])
}

function firstQueryValue(value: string | string[] | undefined): string | undefined {
  if (Array.isArray(value)) {
    return value.find((v) => typeof v === "string" && v.length > 0)
  }
  return typeof value === "string" && value.length > 0 ? value : undefined
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== "GET") {
    return res.setHeader("Allow", "GET").status(405).json({ error: "method not allowed" })
  }

  if (!isRequestOriginAllowed(req, [CONFIG.link, process.env.NEXT_PUBLIC_SITE_URL, process.env.SITE_URL, process.env.NEXT_PUBLIC_APP_URL, process.env.VERCEL_URL])) {
    return res.status(403).json({ error: "forbidden" })
  }

  if (!checkRefreshImageRateLimit(getIpHash(req)).ok) {
    return res.status(429).json({ error: "too many requests" })
  }

  const rawBlockId = firstQueryValue(req.query.blockId)

  if (!rawBlockId || !isValidNotionId(rawBlockId)) {
    return res.status(400).json({ error: "Missing or invalid blockId parameter" })
  }

  const blockId = normalizeNotionId(rawBlockId)

  try {
    const notion = getOfficialNotionClient()
    const block = await withTimeout(
      notion.blocks.retrieve({ block_id: blockId }),
      NOTION_TIMEOUT_MS
    )

    const blockType = (block as any).type
    const blockValue = (block as any)[blockType]

    if (!blockValue || typeof blockValue !== "object") {
      return res.status(404).json({ error: "Block value not found" })
    }

    let imageUrl: string | null = null

    if (blockValue.type === "file" && blockValue.file?.url) {
      imageUrl = blockValue.file.url
    } else if (blockValue.type === "external" && blockValue.external?.url) {
      imageUrl = blockValue.external.url
    } else if (Array.isArray(blockValue.file) && blockValue.file[0]?.url) {
      imageUrl = blockValue.file[0].url
    }

    if (!imageUrl) {
      return res.status(404).json({ error: "Image URL not found in block" })
    }

    return res.status(200).json({
      blockId,
      type: blockType,
      url: imageUrl,
    })
  } catch (error) {
    console.error("Error refreshing image URL:", error)
    return res.status(500).json({ error: "Failed to refresh image URL" })
  }
}

export const config = {
  api: {
    bodyParser: true,
  },
}
