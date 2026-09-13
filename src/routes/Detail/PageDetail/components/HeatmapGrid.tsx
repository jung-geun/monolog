import { useState } from "react"

export type HeatmapCell = {
  date: string
  count: number
  level: number
}

export type HeatmapMonth = {
  label: string
  col: number
}

const LEVEL_CLS = [
  "bg-elevated",
  "bg-grass-1",
  "bg-grass-2",
  "bg-grass-3",
  "bg-grass-4",
]

type Props = {
  weeks: HeatmapCell[][]
  months: HeatmapMonth[]
  formatTooltip: (cell: HeatmapCell) => string
}

const HeatmapGrid = ({ weeks, months, formatTooltip }: Props) => {
  const [tooltip, setTooltip] = useState<{
    text: string
    x: number
    y: number
  } | null>(null)

  return (
    <div className="relative overflow-x-auto">
      <div className="flex mb-1 pl-0" style={{ gap: 2 }}>
        {weeks.map((_, weekIndex) => {
          const month = months.find((item) => item.col === weekIndex)
          return (
            <div key={weekIndex} style={{ width: 10, flexShrink: 0 }}>
              {month ? (
                <span className="font-mono text-[9px] text-mute whitespace-nowrap">
                  {month.label}
                </span>
              ) : null}
            </div>
          )
        })}
      </div>

      <div className="flex" style={{ gap: 2 }}>
        {weeks.map((column, weekIndex) => (
          <div key={weekIndex} className="flex flex-col" style={{ gap: 2 }}>
            {column.map((cell) => (
              <div
                key={cell.date}
                className={`rounded-[2px] cursor-default ${LEVEL_CLS[cell.level]}`}
                style={{ width: 10, height: 10, flexShrink: 0 }}
                onMouseEnter={(event) => {
                  const target = event.currentTarget
                  const rect = target.getBoundingClientRect()
                  const parent = target.closest(".relative")!.getBoundingClientRect()
                  setTooltip({
                    text: formatTooltip(cell),
                    x: rect.left - parent.left + 5,
                    y: rect.top - parent.top - 26,
                  })
                }}
                onMouseLeave={() => setTooltip(null)}
              />
            ))}
          </div>
        ))}
      </div>

      {tooltip && (
        <div
          className="pointer-events-none absolute z-10 rounded bg-elevated border border-hairline px-2 py-1 font-mono text-[10px] text-strong whitespace-nowrap shadow"
          style={{ left: tooltip.x, top: tooltip.y }}
        >
          {tooltip.text}
        </div>
      )}
    </div>
  )
}

export default HeatmapGrid
