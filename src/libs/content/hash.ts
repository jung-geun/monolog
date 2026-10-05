import { createHash } from "crypto"
import type { ExtendedRecordMap } from "notion-types"
import { unwrapBlock } from "src/libs/utils/notion/unwrapBlock"

// Only provider-authentication parameters are volatile. Arbitrary application query
// parameters remain meaningful; removing every query would hide real link edits.
function stableUrl(value: string): string {
  if (!/^https?:\/\//i.test(value) && !value.startsWith("/api/image-proxy?")) return value
  try {
    const relative = value.startsWith("/")
    const url = new URL(value, "https://content.invalid")
    const signedHost = /(^|\.)s3[.-]|\.amazonaws\.com$|(^|\.)secure\.notion-static\.com$|(^|\.)prod-files-secure\.s3\./i.test(url.hostname)
    for (const key of Array.from(url.searchParams.keys())) {
      if (signedHost && /^(x-amz-|awsaccesskeyid$|signature$|expires$)/i.test(key)) url.searchParams.delete(key)
      else if (key === "url" && url.pathname === "/api/image-proxy") url.searchParams.set(key, stableUrl(url.searchParams.get(key) || ""))
    }
    url.searchParams.sort()
    return relative ? `${url.pathname}${url.search}` : url.toString()
  } catch { return value }
}
const volatileFields: Record<string, true> = {
  lastEditedTime: true, last_edited_time: true, created_time: true,
  createdTime: true, contentHash: true, contentModifiedTime: true,
  signed_urls: true, version: true, request_id: true,
  last_edited_by: true, created_by: true, last_edited_by_id: true, created_by_id: true,
}
function canonical(value: unknown): unknown {
  if (typeof value === "string") return stableUrl(value)
  if (Array.isArray(value)) return value.map(canonical)
  if (value && typeof value === "object") {
    const result: Record<string, unknown> = {}
    for (const key of Object.keys(value).sort()) {
      if (Object.hasOwn(volatileFields, key)) continue
      const item = (value as Record<string, unknown>)[key]
      if (item !== undefined) result[key] = canonical(item)
    }
    return result
  }
  return value
}
export function contentDigest(value: unknown): string {
  return createHash("sha256").update(JSON.stringify(canonical(value))).digest("hex")
}

// Metadata changes must not invalidate embeddings. The root contributes block
// order, not database properties; all rendered descendants retain their content.
export function articleBodyDigest(recordMap: ExtendedRecordMap, pageId: string): string {
  const root = pageId.replace(/-/g, "").toLowerCase()
  const blocks: Record<string, unknown> = {}
  let content: string[] = []
  for (const [id, boxed] of Object.entries(recordMap.block)) {
    const block = unwrapBlock(boxed)
    if (!block) continue
    if (id.replace(/-/g, "").toLowerCase() === root) content = block.content ?? []
    else blocks[id] = block
  }
  return contentDigest({ content, blocks, collection: recordMap.collection,
    collection_view: recordMap.collection_view, collection_query: recordMap.collection_query,
    notion_user: recordMap.notion_user })
}
