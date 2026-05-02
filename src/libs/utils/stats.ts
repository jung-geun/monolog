import { TPost } from "src/types"

export type BlogStats = {
  posts: number
  categories: number
  tags: number
  words: number
}

export const getStats = (posts: TPost[]): BlogStats => {
  const catSet = new Set<string>()
  const tagSet = new Set<string>()
  let words = 0

  for (const post of posts) {
    if (post.category) post.category.forEach((c) => catSet.add(c))
    if (post.tags) post.tags.forEach((t) => tagSet.add(t))
    // estimate word count from title + summary
    const text = (post.title || "") + " " + (post.summary || "")
    words += Math.ceil(text.split(/\s+/).filter(Boolean).length * 8) // heuristic multiplier
  }

  return {
    posts: posts.length,
    categories: catSet.size,
    tags: tagSet.size,
    words,
  }
}

// Returns a 26×7 activity grid (level 0-4) from post dates
export const getActivityGrid = (posts: TPost[]): number[][] => {
  const now = new Date()
  // Start of Monday 26 weeks ago
  const startMs =
    now.getTime() - 26 * 7 * 24 * 60 * 60 * 1000

  // Build a map of ISO-date → post count
  const countByDate: Record<string, number> = {}
  for (const post of posts) {
    const dateStr = post.date?.start_date || post.createdTime?.slice(0, 10)
    if (dateStr) {
      countByDate[dateStr] = (countByDate[dateStr] || 0) + 1
    }
  }

  const grid: number[][] = []
  const cursor = new Date(startMs)
  // Align cursor to Sunday of the week
  cursor.setDate(cursor.getDate() - cursor.getDay())

  for (let week = 0; week < 26; week++) {
    const col: number[] = []
    for (let day = 0; day < 7; day++) {
      const iso = cursor.toISOString().slice(0, 10)
      const count = countByDate[iso] || 0
      let level = 0
      if (count >= 1) level = 1
      if (count >= 2) level = 2
      if (count >= 4) level = 3
      if (count >= 6) level = 4
      col.push(level)
      cursor.setDate(cursor.getDate() + 1)
    }
    grid.push(col)
  }

  return grid
}
