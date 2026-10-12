import type { Block, ExtendedRecordMap } from "notion-types"
import type { TPost } from "src/types"
import { normalizeNotionId } from "src/libs/utils/notion/rewriteInternalLinks"
import { unwrapBlock } from "src/libs/utils/notion/unwrapBlock"

function notionUrlTarget(href: string, hrefToId: ReadonlyMap<string, string>): string | undefined {
  const relativeTarget = hrefToId.get(href)
  if (relativeTarget) return relativeTarget
  try {
    const url = new URL(href)
    if (!/^https?:$/.test(url.protocol) || !(/(^|\.)notion\.(so|site)$/i.test(url.hostname) || url.hostname === "app.notion.com")) return undefined
    return normalizeNotionId(url.pathname).match(/([0-9a-f]{32})$/i)?.[1]
  } catch {
    return undefined
  }
}

/** Every visible segment must link to the same page; unlinked prose is not a card. */
function wholeTextTarget(title: unknown, hrefToId: ReadonlyMap<string, string>): string | undefined {
  if (!Array.isArray(title)) return undefined
  let target: string | undefined
  for (const segment of title) {
    if (!Array.isArray(segment) || typeof segment[0] !== "string") return undefined
    if (!segment[0].trim()) continue
    if (!Array.isArray(segment[1])) return undefined
    let segmentTarget: string | undefined
    for (const annotation of segment[1]) {
      if (!Array.isArray(annotation)) return undefined
      let annotatedTarget: string | undefined
      if (annotation[0] === "p" && typeof annotation[1] === "string") {
        annotatedTarget = normalizeNotionId(annotation[1])
      } else if (annotation[0] === "‣" && Array.isArray(annotation[1]) && annotation[1][0] === "p" && typeof annotation[1][1] === "string") {
        annotatedTarget = normalizeNotionId(annotation[1][1])
      } else if (annotation[0] === "a" && typeof annotation[1] === "string") {
        annotatedTarget = notionUrlTarget(annotation[1], hrefToId)
        if (!annotatedTarget) return undefined
      } else {
        continue
      }
      if (segmentTarget && annotatedTarget !== segmentTarget) return undefined
      segmentTarget = annotatedTarget
    }
    if (!segmentTarget || (target && segmentTarget !== target)) return undefined
    target = segmentTarget
  }
  return target
}

/**
 * Notion also exports a standalone page link as text containing p+a decorators.
 * RNX would send those through its inline Text renderer, creating nested anchors.
 * Promote only whole-block public links to its non-root page path. Keep the source
 * ID for block anchors and route it to the real target using the returned map.
 */
export function normalizeStandalonePageLinks(
  recordMap: ExtendedRecordMap | null,
  posts: readonly TPost[],
  idToSlug: ReadonlyMap<string, string>,
): { recordMap: ExtendedRecordMap | null; targets: ReadonlyMap<string, string> } {
  const targets = new Map<string, string>()
  if (!recordMap) return { recordMap, targets }
  const publicPosts = new Map<string, TPost>()
  const hrefToId = new Map<string, string>()
  for (const post of posts) {
    const id = normalizeNotionId(post.id)
    const slug = idToSlug.get(id)
    if (post.status.includes("Public") && slug) {
      publicPosts.set(id, post)
      hrefToId.set(`/${slug}`, id)
    }
  }
  const rootId = Object.keys(recordMap.block)[0]
  let blocks: ExtendedRecordMap["block"] | undefined
  for (const [id, boxed] of Object.entries(recordMap.block)) {
    if (!boxed || id === rootId) continue
    const block = unwrapBlock(boxed)
    if (block?.type !== "text" || block.content?.length) continue
    const target = wholeTextTarget(block.properties?.title, hrefToId)
    const post = target ? publicPosts.get(target) : undefined
    if (!target || !post) continue
    const page: Block = { ...block, type: "page", properties: { title: [[post.title]] }, permissions: [], format: block.format ?? {} }
    blocks ??= { ...recordMap.block }
    const value = boxed.value
    blocks[id] = "value" in value && "role" in value
      ? { ...boxed, value: { ...value, value: page } }
      : { ...boxed, value: page }
    targets.set(normalizeNotionId(block.id), target)
  }
  return { recordMap: blocks ? { ...recordMap, block: blocks } : recordMap, targets }
}
