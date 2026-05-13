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
    <div className="mb-8">
      <p className="font-mono text-[13px] mb-3">
        <span className="text-signal">{"### "}</span>
        <span className="text-strong">tags</span>
        <span className="text-mute ml-2 italic text-[11px]">
          {`// weighted by count, sorted by use · ${sorted.length} tags`}
        </span>
      </p>
      <div className="flex flex-wrap gap-x-3 gap-y-1.5 items-baseline">
        {sorted.map(([name, count]) => (
          <Link
            key={name}
            href={`/search?q=${encodeURIComponent(name)}`}
            className="font-mono leading-none transition-colors hover:text-signal"
            style={{ fontSize: `${fontSizeFor(count)}px`, opacity: opacityFor(count) }}
          >
            <span className="text-mute">#</span>
            <span className="text-strong">{name}</span>
            <span className="ml-0.5 text-mute text-[10px]">{count}</span>
          </Link>
        ))}
      </div>
    </div>
  )
}

export default TagCloud
