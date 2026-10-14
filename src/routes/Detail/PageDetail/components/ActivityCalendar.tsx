import { useCallback, useMemo } from "react"
import { HeatmapChart } from "src/components/charts/heatmap/heatmap-chart"
import { HeatmapCells } from "src/components/charts/heatmap/heatmap-cells"
import {
  HeatmapInteractionBoundary,
  HeatmapInteractionProvider,
} from "src/components/charts/heatmap/heatmap-context"
import type { HeatmapBin, HeatmapColumn } from "src/components/charts/heatmap/heatmap-context"
import type { HeatmapLevelStyles } from "src/components/charts/heatmap/heatmap-colors"
import { HeatmapXAxis } from "src/components/charts/heatmap/heatmap-x-axis"
import { HeatmapYAxis } from "src/components/charts/heatmap/heatmap-y-axis"
import { HeatmapLegend } from "src/components/charts/heatmap/heatmap-legend"
import { HeatmapTooltip } from "src/components/charts/heatmap/heatmap-tooltip"
import type { ActivityCalendarCell, ActivityCalendarMonth } from "./activityCalendarTypes"

// Share the exact same styles with Bklit's cells and interactive legend.
const LEVEL_STYLES: HeatmapLevelStyles = [
  { color: "rgb(var(--c-elevated) / 1)", fillMode: "solid" },
  { color: "rgb(var(--c-grass-1) / 1)", fillMode: "solid" },
  { color: "rgb(var(--c-grass-2) / 1)", fillMode: "solid" },
  { color: "rgb(var(--c-grass-3) / 1)", fillMode: "solid" },
  { color: "rgb(var(--c-grass-4) / 1)", fillMode: "solid" },
]
const MARGIN = { top: 24, right: 16, bottom: 24, left: 40 }

interface Props {
  weeks: ActivityCalendarCell[][]
  months: ActivityCalendarMonth[]
  label: string
  formatTooltip: (cell: ActivityCalendarCell) => string
}

/** Maps civil calendar data to the genuine Bklit composition, not a second renderer. */
export default function ActivityCalendar({ weeks, months, label, formatTooltip }: Props) {
  const { data, cellsByDate, total, activeDays } = useMemo(() => {
    const cellsByDate = new Map<string, ActivityCalendarCell>()
    let total = 0
    let activeDays = 0
    const data: HeatmapColumn[] = []
    for (let column = 0; column < weeks.length; column++) {
      const week = weeks[column]
      const bins: HeatmapBin[] = []
      for (let row = 0; row < week.length; row++) {
        const cell = week[row]
        cellsByDate.set(cell.date, cell)
        total += cell.count
        if (cell.count > 0) activeDays++
        // Bklit expects 0–4 here; raw counts stay in cellsByDate.
        bins.push({ bin: row, count: cell.level, date: new Date(`${cell.date}T00:00:00Z`) })
      }
      data.push({ bin: column, bins })
    }
    return { data, cellsByDate, total, activeDays }
  }, [weeks])

  const formatLabel = useCallback((_level: number, date: Date) => {
    const cell = cellsByDate.get(date.toISOString().slice(0, 10))
    return cell ? formatTooltip(cell) : ""
  }, [cellsByDate, formatTooltip])
  const formatCellLabel = useCallback((bin: HeatmapBin) => formatLabel(bin.count, bin.date), [formatLabel])
  const firstDate = weeks[0]?.[0]?.date
  const lastDate = weeks[weeks.length - 1]?.[6]?.date

  return (
    <div className="w-full min-w-0 max-w-full" role="group" aria-label={`${label}: ${total} total, ${activeDays} active days; ${firstDate} to ${lastDate}, UTC`}>
      <p className="sr-only">Daily activity, Sunday through Saturday. Tab into the calendar and use arrow keys to read each date and count. Escape dismisses the tooltip.</p>
      <HeatmapInteractionProvider>
        <HeatmapInteractionBoundary>
          <div className="w-full min-w-0 max-w-full overflow-x-auto overscroll-x-contain">
            <div style={{ minWidth: 680 }}>
              <HeatmapChart data={data} layout="fluid" margin={MARGIN} gap={2} levelStyles={LEVEL_STYLES} animate={false}>
                <HeatmapCells hideGhostCells={false} formatCellLabel={formatCellLabel} />
                <HeatmapXAxis ticks={months} className="font-mono text-[10px] text-mute" />
                <HeatmapYAxis tickFilter="all" className="font-mono text-[9px] leading-none text-mute" />
                <HeatmapTooltip formatLabel={formatLabel} instant />
              </HeatmapChart>
            </div>
          </div>
          <HeatmapLegend levelStyles={LEVEL_STYLES} cellSize={10} gap={2} fontSize={10} className="mt-1 font-mono text-mute" />
        </HeatmapInteractionBoundary>
      </HeatmapInteractionProvider>
    </div>
  )
}
