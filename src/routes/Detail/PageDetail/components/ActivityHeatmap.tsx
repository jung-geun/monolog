import { useMemo } from "react"
import usePostsQuery from "src/hooks/usePostsQuery"
import type { TPost } from "src/types"
import HeatmapGrid from "./HeatmapGrid"
import type { HeatmapCell, HeatmapMonth } from "./HeatmapGrid"

function buildGrid(posts: TPost[]): {
  weeks: HeatmapCell[][]
  months: HeatmapMonth[]
} {
  const now = new Date()
  const startDate = new Date(now)
  startDate.setDate(startDate.getDate() - 52 * 7)
  // align to Sunday
  startDate.setDate(startDate.getDate() - startDate.getDay())

  const countByDate: Record<string, number> = {}
  for (const post of posts) {
    const d = post.date?.start_date || post.createdTime?.slice(0, 10)
    if (d) countByDate[d] = (countByDate[d] || 0) + 1
  }

  const weeks: HeatmapCell[][] = []
  const months: HeatmapMonth[] = []
  let lastMonth = -1

  const cursor = new Date(startDate)
  for (let w = 0; w < 52; w++) {
    const col: HeatmapCell[] = []
    for (let d = 0; d < 7; d++) {
      const iso = cursor.toISOString().slice(0, 10)
      const count = countByDate[iso] || 0
      let level = 0
      if (count >= 1) level = 1
      if (count >= 2) level = 2
      if (count >= 4) level = 3
      if (count >= 6) level = 4
      col.push({ date: iso, count, level })
      cursor.setDate(cursor.getDate() + 1)
    }
    const mo = new Date(col[0].date).getMonth()
    if (mo !== lastMonth) {
      months.push({ label: new Date(col[0].date).toLocaleString("en", { month: "short" }), col: w })
      lastMonth = mo
    }
    weeks.push(col)
  }

  return { weeks, months }
}

const ActivityHeatmap = () => {
  const posts = usePostsQuery()
  const { weeks, months } = useMemo(() => buildGrid(posts), [posts])

  return (
    <div className="mb-8">
      <p className="font-mono text-[13px] mb-2">
        <span className="text-signal">{"### "}</span>
        <span className="text-strong">writing.activity</span>
        <span className="text-mute ml-2 italic text-[11px]">{"// last 52 weeks"}</span>
      </p>

      <HeatmapGrid
        weeks={weeks}
        months={months}
        formatTooltip={(cell) =>
          `${cell.date}: ${cell.count} post${cell.count !== 1 ? "s" : ""}`
        }
      />

      <p className="font-mono text-[10px] text-mute mt-2">
        {posts.length} total entries
      </p>
    </div>
  )
}

export default ActivityHeatmap
