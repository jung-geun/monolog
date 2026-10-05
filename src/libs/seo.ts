import { CONFIG } from "site.config"
import type { TPost, TPosts } from "src/types"
import { filterPosts } from "src/libs/utils/notion/filterPosts"
import type { FilterPostsOptions } from "src/libs/utils/notion/filterPosts"

export const PUBLIC_DETAIL_FILTER: FilterPostsOptions = {
  acceptStatus: ["Public", "PublicOnDetail"],
  acceptType: ["Post", "Paper", "Page"],
}

export const publicDetails = (posts: TPosts): TPosts =>
  filterPosts(posts, PUBLIC_DETAIL_FILTER)

export const absoluteUrl = (path: string): string => {
  const url = new URL(path, `${CONFIG.link.replace(/\/+$/, "")}/`)
  if (url.protocol !== "https:" && url.protocol !== "http:") {
    throw new Error("Public URLs must use HTTP or HTTPS")
  }
  return url.toString()
}

export const postUrl = (slug: string): string => absoluteUrl(`/${encodeURIComponent(slug)}`)
export const markdownUrl = (slug: string): string => absoluteUrl(`/${encodeURIComponent(slug)}.md`)

export const validDate = (raw?: string): string | undefined => {
  if (!raw) return undefined
  const date = new Date(raw)
  return Number.isFinite(date.getTime()) ? date.toISOString() : undefined
}

export const publishedDate = (post: TPost): string | undefined =>
  validDate(post.date?.start_date) ?? validDate(post.createdTime)

export const modifiedDate = (post: TPost): string | undefined =>
  validDate(post.contentModifiedTime) ?? validDate(post.lastEditedTime)

const calendarDateFormatter = new Intl.DateTimeFormat("en-CA", {
  timeZone: CONFIG.timeZone, year: "numeric", month: "2-digit", day: "2-digit",
})
export const calendarDate = (iso: string): string => calendarDateFormatter.format(new Date(iso))

export const summaryText = (summary?: unknown): string => {
  if (typeof summary === "string") return summary
  if (Array.isArray(summary)) {
    return summary.filter((part): part is string => typeof part === "string").join("")
  }
  return ""
}
const xmlEntities: Record<string, string> = {
  "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&apos;",
}

export const escapeXml = (value: string): string =>
  value.replace(/[&<>"']/g, (character) => xmlEntities[character])
export const serializeJsonLd = (value: unknown): string =>
  JSON.stringify(value).replace(/</g, "\\u003c").replace(/>/g, "\\u003e")
    .replace(/&/g, "\\u0026").replace(/\u2028/g, "\\u2028").replace(/\u2029/g, "\\u2029")
