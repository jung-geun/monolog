import type { ExtendedRecordMap } from "notion-types"
import type { ContentState, ContentSnapshot } from "./types"

export function snapshotOf(state: ContentState): ContentSnapshot {
  const entries = Object.values(state.entries)
  const posts = entries.flatMap(entry => entry.post ? [entry.post] : [])
  posts.sort((a, b) => Date.parse(b.date.start_date) - Date.parse(a.date.start_date) || a.id.localeCompare(b.id))
  const recordMaps: Record<string, ExtendedRecordMap> = {}
  const redirects: Record<string, string> = {}
  const owners: Record<string, string> = {}
  for (const post of posts) owners[post.slug] = post.id.replace(/-/g, "").toLowerCase()
  for (const entry of entries) {
    if (!entry.post || !entry.recordMap) continue
    recordMaps[entry.post.id] = entry.recordMap
    for (const slug of entry.slugHistory) {
      if (slug === entry.post.slug || Object.hasOwn(owners, slug)) continue
      // Reclaimed slugs never become aliases again, even after the claimant is
      // deleted. No old URL may redirect into another page's content.
      if (entries.some(other => other.id !== entry.id && other.slugHistory.includes(slug))) continue
      redirects[slug] = `/${entry.post.slug}`
    }
  }
  return { posts, recordMaps, redirects, revision: state.revision }
}
