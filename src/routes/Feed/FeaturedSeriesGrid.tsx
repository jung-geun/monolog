import Link from "next/link"
import { useSeriesQuery } from "src/hooks/useSeriesQuery"

const COLORS = ["signal", "paper", "cs", "research"] as const
type Color = (typeof COLORS)[number]

const GRADIENTS: Record<Color, string> = {
  signal:   "bg-gradient-to-br from-signal-900 to-signal",
  paper:    "bg-gradient-to-br from-paper-900 to-paper",
  cs:       "bg-gradient-to-br from-cs-900 to-cs",
  research: "bg-gradient-to-br from-research-900 to-research",
}

function pickColor(name: string): Color {
  let h = 0
  for (let i = 0; i < name.length; i++) h += name.charCodeAt(i)
  return COLORS[h % COLORS.length]
}

const FeaturedSeriesGrid = () => {
  const series = useSeriesQuery()
  const entries = Object.entries(series).sort((a, b) => b[1] - a[1])

  if (!entries.length) return null

  return (
    <div className="mb-8">
      <p className="font-mono text-[13px] mb-2">
        <span className="text-signal">{"### "}</span>
        <span className="text-strong">series</span>
      </p>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        {entries.map(([name, count]) => {
          const color = pickColor(name)
          return (
            <Link
              key={name}
              href={`/series/${name}`}
              className="group flex items-center gap-3 rounded-md border border-hairline bg-card/60 p-2.5 transition-colors hover:border-signal/45 hover:bg-card"
            >
              <span
                className={`grid h-9 w-9 shrink-0 place-items-center rounded font-mono text-sm font-medium text-zinc-50 ${GRADIENTS[color]}`}
              >
                §
              </span>
              <div className="flex-1 min-w-0">
                <p className="truncate font-medium text-[13px] text-strong">{name}</p>
                <p className="font-mono text-[10px] text-mute">
                  {count} entries{count >= 10 ? " · ongoing" : ""}
                </p>
              </div>
              <span className="font-mono text-xs text-mute transition-colors group-hover:text-signal dark:group-hover:text-signal-200">
                →
              </span>
            </Link>
          )
        })}
      </div>
    </div>
  )
}

export default FeaturedSeriesGrid
