import { TPost } from "src/types"

export type BlogStats = {
  posts: number
  categories: number
  tags: number
  words: number
  series: number
}

export const getStats = (posts: TPost[]): BlogStats => {
  const catSet = new Set<string>()
  const tagSet = new Set<string>()
  const seriesSet = new Set<string>()
  let words = 0

  for (const post of posts) {
    if (post.category) post.category.forEach((c) => catSet.add(c))
    if (post.tags) post.tags.forEach((t) => tagSet.add(t))
    if (post.series) post.series.forEach((s) => seriesSet.add(s))
    const text = (post.title || "") + " " + (post.summary || "")
    words += Math.ceil(text.split(/\s+/).filter(Boolean).length * 8)
  }

  return {
    posts: posts.length,
    categories: catSet.size,
    tags: tagSet.size,
    words,
    series: seriesSet.size,
  }
}

