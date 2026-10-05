import type { ExtendedRecordMap } from "notion-types"
import type { TPosts } from "src/types"
import { readStoredContent } from "./storage"
import { snapshotOf } from "./snapshot"

// null is a cold registry, not an empty public site. Once initialized, [] is
// authoritative and must never trigger a live fallback that resurrects drafts.
export async function readContentSnapshot(): Promise<TPosts | null> {
  const state = await readStoredContent()
  if (!state?.initialized) return null
  return snapshotOf(state).posts
}
export async function readContentRecordMap(pageId: string): Promise<ExtendedRecordMap | null> {
  const state = await readStoredContent()
  if (!state?.initialized) return null
  const entry = state.entries[pageId.replace(/-/g, "").toLowerCase()]
  return entry?.post && entry.recordMap ? entry.recordMap : null
}
export async function getSlugRedirect(slug: string): Promise<string | null> {
  const state = await readStoredContent()
  if (!state?.initialized) return null
  const redirects = snapshotOf(state).redirects
  return Object.hasOwn(redirects, slug) ? redirects[slug].slice(1) : null
}
