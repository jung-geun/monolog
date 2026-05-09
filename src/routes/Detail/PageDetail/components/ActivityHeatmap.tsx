import { useMemo, useState } from "react"
import usePostsQuery from "src/hooks/usePostsQuery"

type Cell = { date: string; count: number; level: number }

const LEVEL_CLS = [
  "bg-elevated",
  "bg-signal opacity-25",
  "bg-signal opacity-50",
  "bg-signal opacity-75",
  "bg-signal",
]

function buildGrid(posts: ReturnType<typeof usePostsQuery>): { weeks: Cell[][]; months: { label: string; col: number }[] } {
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

  const weeks: Cell[][] = []
  const months: { label: string; col: number }[] = []
  let lastMonth = -1

  const cursor = new Date(startDate)
  for (let w = 0; w < 52; w++) {
    const col: Cell[] = []
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
  const [tooltip, setTooltip] = useState<{ text: string; x: number; y: number } | null>(null)

  return (
    <div className="mb-8">
      <p className="font-mono text-[13px] mb-2">
        <span className="text-signal">{"### "}</span>
        <span className="text-strong">writing.activity</span>
        <span className="text-mute ml-2 italic text-[11px]">{"// last 52 weeks"}</span>
      </p>

      <div className="relative overflow-x-auto">
        {/* month labels */}
        <div className="flex mb-1 pl-0" style={{ gap: 2 }}>
          {weeks.map((_, wi) => {
            const m = months.find((mo) => mo.col === wi)
            return (
              <div key={wi} style={{ width: 10, flexShrink: 0 }}>
                {m ? (
                  <span className="font-mono text-[9px] text-mute whitespace-nowrap">{m.label}</span>
                ) : null}
              </div>
            )
          })}
        </div>

        {/* grid */}
        <div className="flex" style={{ gap: 2 }}>
          {weeks.map((col, wi) => (
            <div key={wi} className="flex flex-col" style={{ gap: 2 }}>
              {col.map((cell) => (
                <div
                  key={cell.date}
                  className={`rounded-[2px] cursor-default ${LEVEL_CLS[cell.level]}`}
                  style={{ width: 10, height: 10, flexShrink: 0 }}
                  onMouseEnter={(e) => {
                    const rect = (e.target as HTMLElement).getBoundingClientRect()
                    const parent = (e.target as HTMLElement).closest(".relative")!.getBoundingClientRect()
                    setTooltip({
                      text: `${cell.date}: ${cell.count} post${cell.count !== 1 ? "s" : ""}`,
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

        {/* tooltip */}
        {tooltip && (
          <div
            className="pointer-events-none absolute z-10 rounded bg-elevated border border-hairline px-2 py-1 font-mono text-[10px] text-strong whitespace-nowrap shadow"
            style={{ left: tooltip.x, top: tooltip.y }}
          >
            {tooltip.text}
          </div>
        )}
      </div>

      <p className="font-mono text-[10px] text-mute mt-2">
        {posts.length} total entries
      </p>
    </div>
  )
}

export default ActivityHeatmap
