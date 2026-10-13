import type { TPost } from "src/types"
import type { HeatmapCell, HeatmapMonth } from "./HeatmapGrid"

export function buildActivityGrid(posts: Pick<TPost, "date" | "createdTime">[], referenceTime: number): {
  weeks: HeatmapCell[][]
  months: HeatmapMonth[]
} {
  // The publication query timestamp is serialized with ISR HTML. Using that
  // same civil-day anchor prevents timezone and cache-age hydration drift.
  const startDate = new Date(referenceTime)
  startDate.setUTCHours(0, 0, 0, 0)
  startDate.setUTCDate(startDate.getUTCDate() - 52 * 7)
  startDate.setUTCDate(startDate.getUTCDate() - startDate.getUTCDay())

  const countByDate: Record<string, number> = {}
  for (const post of posts) {
    const date = post.date?.start_date || post.createdTime?.slice(0, 10)
    if (date) countByDate[date] = (countByDate[date] || 0) + 1
  }

  const weeks: HeatmapCell[][] = []
  const months: HeatmapMonth[] = []
  let lastMonth = -1
  const cursor = new Date(startDate)
  for (let week = 0; week < 52; week++) {
    const column: HeatmapCell[] = []
    for (let day = 0; day < 7; day++) {
      const date = cursor.toISOString().slice(0, 10)
      const count = countByDate[date] || 0
      let level = 0
      if (count >= 1) level = 1
      if (count >= 2) level = 2
      if (count >= 4) level = 3
      if (count >= 6) level = 4
      column.push({ date, count, level })
      cursor.setUTCDate(cursor.getUTCDate() + 1)
    }
    const firstDate = new Date(`${column[0].date}T00:00:00Z`)
    const month = firstDate.getUTCMonth()
    if (month !== lastMonth) {
      months.push({ label: firstDate.toLocaleString("en", { month: "short", timeZone: "UTC" }), col: week })
      lastMonth = month
    }
    weeks.push(column)
  }
  return { weeks, months }
}
