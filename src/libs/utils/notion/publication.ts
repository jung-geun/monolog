import type { TPost, TPosts } from "src/types"

const PUBLIC_STATUSES: Record<string, true> = { Public: true, PublicOnDetail: true }
const POST_TYPES: Record<string, true> = { Post: true, Paper: true, Page: true }
const RESERVED_SLUGS: Record<string, true> = {
  api: true, _next: true, "404": true, search: true, graph: true, ontology: true,
  graphs: true, categories: true, series: true,
}

export function isSafePostSlug(slug: string): boolean {
  return typeof slug === "string" && /^[\p{L}\p{N}][\p{L}\p{N}_-]*$/u.test(slug) && !Object.hasOwn(RESERVED_SLUGS, slug.toLowerCase())
}

export function isPublicPost(post: TPost, now = Date.now()): boolean {
  const date = Date.parse(post.date?.start_date || post.createdTime)
  return Boolean(post.id && post.title.trim() && isSafePostSlug(post.slug) &&
    Object.hasOwn(PUBLIC_STATUSES, post.status?.[0]) && Object.hasOwn(POST_TYPES, post.type?.[0]) &&
    Number.isFinite(date) && date <= now)
}

export function isFeedPost(post: TPost): boolean {
  return isPublicPost(post) && post.status[0] === "Public" && post.type[0] !== "Page"
}

export function sortPosts(posts: TPosts): TPosts {
  return posts.sort((a, b) => Date.parse(b.date?.start_date || b.createdTime) - Date.parse(a.date?.start_date || a.createdTime))
}

export function selectPublicPosts(posts: TPosts): TPosts {
  const eligible = posts.filter((post) => isPublicPost(post))
  const counts = new Map<string, number>()
  for (const post of eligible) counts.set(post.slug, (counts.get(post.slug) ?? 0) + 1)
  return sortPosts(eligible.filter((post) => counts.get(post.slug) === 1))
}
