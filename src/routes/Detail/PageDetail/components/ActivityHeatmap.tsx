import { useMemo } from "react"
import usePostsQuery from "src/hooks/usePostsQuery"
import { useQueryClient } from "@tanstack/react-query"
import { queryKey } from "src/constants/queryKey"
import { buildActivityGrid } from "./activityGrid"
import HeatmapGrid from "./HeatmapGrid"


const ActivityHeatmap = () => {
  const posts = usePostsQuery()
  const referenceTime = useQueryClient().getQueryState(queryKey.posts())?.dataUpdatedAt
  const grid = useMemo(() => referenceTime ? buildActivityGrid(posts, referenceTime) : null, [posts, referenceTime])
  if (!grid) return null
  const { weeks, months } = grid

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
