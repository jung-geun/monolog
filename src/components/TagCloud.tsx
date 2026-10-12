import { useMemo } from "react"
import Link from "next/link"
import { useTagsQuery } from "src/hooks/useTagsQuery"

const TagCloud = () => {
  const tags = useTagsQuery()

  const sorted = useMemo(
    () => Object.entries(tags).sort((a, b) => b[1] - a[1]),
    [tags]
  )

  if (!sorted.length) return null

  const max = sorted[0][1]
  const min = sorted[sorted.length - 1][1]

  const fontSizeFor = (c: number) => {
    if (max === min) return 13
    const t = (c - min) / (max - min)
    return 11 + t * 7
  }

  return (
    <div className="mb-10">
      <div className="flex items-baseline justify-between mb-3">
        <h2 className="font-sans text-base font-semibold text-strong">Tags</h2>
        <span className="font-mono text-xs text-mute">{sorted.length} tags</span>
      </div>
      <div className="flex flex-wrap gap-x-3 gap-y-2 items-baseline">
        {sorted.map(([name, count]) => (
          <Link
            key={name}
            href={`/search?q=${encodeURIComponent(name)}`}
            className="group inline-flex min-h-6 min-w-6 items-baseline gap-0.5 py-1 leading-none rounded-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-current"
            style={{ fontSize: `${fontSizeFor(count)}px` }}
          >
            <span className="font-mono text-mute group-hover:text-signal dark:group-hover:text-signal-200">#</span>
            <span className="font-sans font-medium text-strong group-hover:text-signal dark:group-hover:text-signal-200">{name}</span>
            <span className="font-mono text-[10px] text-mute ml-0.5">{count}</span>
          </Link>
        ))}
      </div>
    </div>
  )
}

export default TagCloud
