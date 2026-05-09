import type { ExtendedRecordMap } from "notion-types"

const NOTION_ID_RE =
  /^https?:\/\/(?:[\w-]+\.)?notion\.(?:so|site)\/(?:[^?#]*?)([0-9a-f]{32})(?:[?#]|$)/i

const normalizeNotionId = (id: string) => id.replace(/-/g, "").toLowerCase()

export const buildIdToSlug = (
  posts: ReadonlyArray<{ id?: string; slug?: string }>,
): Map<string, string> => {
  const map = new Map<string, string>()
  for (const p of posts) {
    if (p.id && p.slug) map.set(normalizeNotionId(p.id), p.slug)
  }
  return map
}

const remapHref = (
  url: string,
  idToSlug: Map<string, string>,
): string | null => {
  const m = url.match(NOTION_ID_RE)
  if (!m) return null
  const slug = idToSlug.get(m[1].toLowerCase())
  return slug ? `/${slug}` : null
}

type RichText = unknown[]

const rewriteRichText = (
  rt: unknown,
  idToSlug: Map<string, string>,
): unknown => {
  if (!Array.isArray(rt)) return rt
  let changed = false
  const next = (rt as RichText).map((segment) => {
    if (!Array.isArray(segment) || !Array.isArray(segment[1])) return segment
    const annotations = segment[1] as unknown[]
    let segChanged = false
    const newAnno = annotations.map((a) => {
      if (Array.isArray(a) && a[0] === "a" && typeof a[1] === "string") {
        const replaced = remapHref(a[1], idToSlug)
        if (replaced) {
          segChanged = true
          return ["a", replaced]
        }
      }
      return a
    })
    if (segChanged) {
      changed = true
      return [segment[0], newAnno]
    }
    return segment
  })
  return changed ? next : rt
}

export const rewriteRecordMapInternalLinks = (
  recordMap: ExtendedRecordMap | null,
  idToSlug: Map<string, string>,
): ExtendedRecordMap | null => {
  if (!recordMap) return recordMap
  if (idToSlug.size === 0) return recordMap

  let blockChanged = false
  const newBlocks: ExtendedRecordMap["block"] = {}
  for (const [id, entry] of Object.entries(recordMap.block)) {
    const block = (entry as { value?: { properties?: Record<string, unknown> } })?.value
    const props = block?.properties
    if (!block || !props) {
      newBlocks[id] = entry
      continue
    }
    let anyChanged = false
    const newProps: Record<string, unknown> = { ...props }
    for (const key of Object.keys(props)) {
      const newRT = rewriteRichText(props[key], idToSlug)
      if (newRT !== props[key]) {
        newProps[key] = newRT
        anyChanged = true
      }
    }
    if (anyChanged) {
      blockChanged = true
      newBlocks[id] = {
        ...entry,
        value: { ...block, properties: newProps },
      } as ExtendedRecordMap["block"][string]
    } else {
      newBlocks[id] = entry
    }
  }

  if (!blockChanged) return recordMap
  return { ...recordMap, block: newBlocks }
}
