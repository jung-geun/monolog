import Link from "next/link"
import { useSeriesQuery } from "src/hooks/useSeriesQuery"

const FeaturedSeriesGrid = () => {
  const series = useSeriesQuery()
  const entries = Object.entries(series).sort((a, b) => b[1] - a[1])

  if (!entries.length) return null

  return (
    <section className="mb-10" aria-labelledby="featured-series-heading">
      <div className="flex items-baseline justify-between mb-3">
        <h2 id="featured-series-heading" className="font-sans text-base font-semibold text-strong">Series</h2>
        <span className="font-mono text-xs text-mute">{entries.length} series</span>
      </div>
      <div className="series-cards-flow">
        {entries.map(([name, count]) => {
          return (
            <Link
              key={name}
              href={`/series/${name}`}
              className="group flex items-center gap-3 rounded-[12px] border border-hairline bg-card p-3 mb-3 transition-colors hover:border-signal/45 hover:bg-card/85"
            >
              <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg font-mono text-sm font-medium bg-elevated text-mute group-hover:bg-signal-50 group-hover:text-signal-900 dark:group-hover:text-signal-200 transition-colors">
                §
              </span>
              <div className="flex-1 min-w-0">
                <p className="font-sans text-sm font-medium text-strong truncate group-hover:text-signal transition-colors">
                  {name}
                </p>
                <p className="font-mono text-xs text-mute">
                  {count} entries{count >= 10 ? " · ongoing" : ""}
                </p>
              </div>
              <span className="font-mono text-xs text-mute motion-safe:transition-[color,translate] duration-150 motion-safe:group-hover:translate-x-1 motion-safe:group-focus-visible:translate-x-1 group-hover:text-signal">
                →
              </span>
            </Link>
          )
        })}
      </div>
    </section>
  )
}

export default FeaturedSeriesGrid
