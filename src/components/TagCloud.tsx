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

  const opacityFor = (c: number) => {
    if (max === min) return 0.85
    const t = (c - min) / (max - min)
    return 0.55 + t * 0.45
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
            className="group inline-flex items-baseline gap-0.5 leading-none transition-colors"
            style={{ fontSize: `${fontSizeFor(count)}px`, opacity: opacityFor(count) }}
          >
            <span className="font-mono text-mute group-hover:text-signal/70 transition-colors">#</span>
            <span className="font-sans font-medium text-strong group-hover:text-signal transition-colors">{name}</span>
            <span className="font-mono text-[10px] text-mute ml-0.5">{count}</span>
          </Link>
        ))}
      </div>
    </div>
  )
}

export default TagCloud
