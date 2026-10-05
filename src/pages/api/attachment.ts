import type { NextApiRequest, NextApiResponse } from "next"
import type { Block, ExtendedRecordMap } from "notion-types"
import { isFullBlock } from "@notionhq/client"
import { getOfficialNotionClient } from "src/apis/notion-client/notionClient"
import { readContentRecordMap } from "src/libs/content/registry"
import { unwrapBlock } from "src/libs/utils/notion/unwrapBlock"
import { isValidNotionId, normalizeNotionId } from "src/libs/utils/security"

const ATTACHMENT_TYPES: Record<string, true> = { file: true, pdf: true, video: true, audio: true }

// Presence in block alone is not authority: linked-page stubs and detached
// blocks can also be in a recordMap. Walk only the published root's content.
function publishedAttachment(map: ExtendedRecordMap, pageId: string, blockId: string): Block | undefined {
  const blocks = new Map(Object.entries(map.block).map(([id, boxed]) => [normalizeNotionId(id), unwrapBlock(boxed)]))
  const root = blocks.get(pageId)
  if (root?.type !== "page" || root.alive === false) return undefined
  const pending = [...(root.content || [])]
  const visited = new Set<string>([pageId])
  while (pending.length) {
    const id = normalizeNotionId(pending.pop()!)
    if (visited.has(id)) continue
    visited.add(id)
    const block = blocks.get(id)
    if (!block || block.alive === false) continue
    if (id === blockId) return Object.hasOwn(ATTACHMENT_TYPES, block.type) ? block : undefined
    // A child page is a link, not part of this page's live body.
    if (block.type !== "page") pending.push(...(block.content || []))
  }
  return undefined
}

function trustedFileUrl(raw: string): boolean {
  try {
    const url = new URL(raw)
    if (url.protocol !== "https:" || url.username || url.password || url.port) return false
    return /^prod-files-secure\.s3(?:[.-][a-z0-9-]+)?\.amazonaws\.com$/.test(url.hostname)
      || url.hostname === "secure.notion-static.com"
      || (url.hostname === "s3.us-west-2.amazonaws.com" && url.pathname.startsWith("/secure.notion-static.com/"))
  } catch {
    return false
  }
}

export default async function handler(req: NextApiRequest, res: NextApiResponse): Promise<void> {
  res.setHeader("Cache-Control", "no-store")
  if (req.method !== "GET" && req.method !== "HEAD") {
    res.setHeader("Allow", "GET, HEAD")
    res.status(405).end()
    return
  }
  const { pageId: rawPageId, blockId: rawBlockId } = req.query
  if (typeof rawPageId !== "string" || typeof rawBlockId !== "string"
    || !isValidNotionId(rawPageId) || !isValidNotionId(rawBlockId)) {
    res.status(404).end()
    return
  }
  const pageId = normalizeNotionId(rawPageId)
  const blockId = normalizeNotionId(rawBlockId)
  try {
    const map = await readContentRecordMap(pageId)
    const published = map && publishedAttachment(map, pageId, blockId)
    if (!published) {
      res.status(404).end()
      return
    }
    const block = await getOfficialNotionClient().blocks.retrieve({ block_id: blockId })
    if (!isFullBlock(block)) {
      res.status(503).end()
      return
    }
    const parentId = block.parent.type === "block_id" ? block.parent.block_id
      : block.parent.type === "page_id" ? block.parent.page_id : undefined
    if (block.archived || block.in_trash || normalizeNotionId(block.id) !== blockId
      || block.type !== published.type || !parentId
      || normalizeNotionId(parentId) !== normalizeNotionId(published.parent_id)) {
      res.status(404).end()
      return
    }
    const data = block.type === "file" ? block.file : block.type === "pdf" ? block.pdf
      : block.type === "video" ? block.video : block.type === "audio" ? block.audio : undefined
    if (!data || data.type !== "file") {
      res.status(404).end()
      return
    }
    if (!trustedFileUrl(data.file.url)) {
      res.status(503).end()
      return
    }
    res.setHeader("Location", data.file.url)
    res.status(307).end()
  } catch (error) {
    // A removed/inaccessible block is not an upstream outage. Neither case
    // changes the durable body, and failures must never cache a stale redirect.
    const notFound = typeof error === "object" && error !== null && "code" in error && error.code === "object_not_found"
    res.status(notFound ? 404 : 503).end()
  }
}
