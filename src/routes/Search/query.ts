import type { TPost } from "src/types"

export type SearchField = "all" | "title" | "summary" | "tags" | "category"
export type SearchTerm = { field: "all" | "tags" | "category"; value: string }

// Quoted values may contain spaces: tag:"machine learning" category:systems.
// All terms must match. Only tag: and category: have special meaning.
export function parseSearchQuery(query: string): SearchTerm[] {
  return (query.match(/(?:[^\s"']+|"[^"]*"|'[^']*')+/g) ?? []).flatMap((token) => {
    const filter = /^(tag|category):(.*)$/i.exec(token)
    const raw = filter ? filter[2] : token
    const value = raw.replace(/^["']|["']$/g, "").toLowerCase()
    if (!value) return []
    const field: SearchTerm["field"] = filter ? (filter[1].toLowerCase() === "tag" ? "tags" : "category") : "all"
    return [{ field, value }]
  })
}

export function matchPost(post: TPost, terms: SearchTerm[], field: SearchField = "all"): boolean {
  return terms.every((term) => {
    const target = term.field === "all" ? field : term.field
    return ((target === "all" || target === "title") && post.title.toLowerCase().includes(term.value))
      || ((target === "all" || target === "summary") && Boolean(post.summary?.toLowerCase().includes(term.value)))
      || ((target === "all" || target === "tags") && Boolean(post.tags?.some(tag => tag.toLowerCase().includes(term.value))))
      || ((target === "all" || target === "category") && Boolean(post.category?.some(category => category.toLowerCase().includes(term.value))))
  })
}

export function searchPosts(posts: TPost[], query: string, field: SearchField = "all"): TPost[] {
  const terms = parseSearchQuery(query)
  return posts.filter((post) => matchPost(post, terms, field))
}

export function highlightRanges(text: string, terms: SearchTerm[], field: Exclude<SearchField, "all">): [number, number][] {
  const lower = text.toLowerCase()
  const ranges: [number, number][] = []
  for (const term of terms) {
    if (term.field !== "all" && term.field !== field) continue
    let start = lower.indexOf(term.value)
    while (start !== -1) {
      ranges.push([start, start + term.value.length])
      start = lower.indexOf(term.value, start + term.value.length)
    }
  }
  ranges.sort((a, b) => a[0] - b[0])
  const merged: [number, number][] = []
  for (const range of ranges) {
    const previous = merged[merged.length - 1]
    if (previous && range[0] <= previous[1]) previous[1] = Math.max(previous[1], range[1])
    else merged.push([...range])
  }
  return merged
}
