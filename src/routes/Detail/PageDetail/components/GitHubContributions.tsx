import { useMemo } from "react"
import { useQuery } from "@tanstack/react-query"
import type {
  GitHubContributionData,
  GitHubContributionDay,
} from "src/libs/github/contributions"
import HeatmapGrid from "./HeatmapGrid"
import type { HeatmapCell, HeatmapMonth } from "./HeatmapGrid"

const WEEK_COUNT = 52

function buildGrid(days: GitHubContributionDay[]): {
  weeks: HeatmapCell[][]
  months: HeatmapMonth[]
} {
  if (days.length === 0) return { weeks: [], months: [] }

  const daysByDate = new Map(days.map((day) => [day.date, day]))
  const latest = new Date(`${days[days.length - 1].date}T00:00:00Z`)
  const firstSunday = new Date(latest)
  firstSunday.setUTCDate(latest.getUTCDate() - latest.getUTCDay() - (WEEK_COUNT - 1) * 7)

  const weeks: HeatmapCell[][] = []
  const months: HeatmapMonth[] = []
  let lastMonth = -1

  for (let weekIndex = 0; weekIndex < WEEK_COUNT; weekIndex++) {
    const column: HeatmapCell[] = []
    for (let dayIndex = 0; dayIndex < 7; dayIndex++) {
      const date = new Date(firstSunday)
      date.setUTCDate(firstSunday.getUTCDate() + weekIndex * 7 + dayIndex)
      const dateKey = date.toISOString().slice(0, 10)
      column.push(daysByDate.get(dateKey) ?? { date: dateKey, count: 0, level: 0 })
    }

    const month = new Date(`${column[0].date}T00:00:00Z`).getUTCMonth()
    if (month !== lastMonth) {
      months.push({
        label: new Date(`${column[0].date}T00:00:00Z`).toLocaleString("en", {
          month: "short",
          timeZone: "UTC",
        }),
        col: weekIndex,
      })
      lastMonth = month
    }
    weeks.push(column)
  }

  return { weeks, months }
}

async function fetchContributions(): Promise<GitHubContributionData> {
  const response = await fetch("/api/github-contributions")
  if (!response.ok) throw new Error("GitHub contributions unavailable")
  return response.json()
}

type Props = {
  username?: string
}

const GitHubContributions = ({ username }: Props) => {
  const { data, isLoading, isError } = useQuery({
    queryKey: ["github-contributions", username],
    queryFn: fetchContributions,
    enabled: Boolean(username),
    staleTime: 60 * 60 * 1000,
    retry: 1,
  })
  const { weeks, months } = useMemo(
    () => buildGrid(data?.days ?? []),
    [data?.days]
  )

  if (!username) return null

  return (
    <div className="mb-8">
      <p className="font-mono text-[13px] mb-2">
        <span className="text-signal">{"### "}</span>
        <span className="text-strong">github.contributions</span>
        <span className="text-mute ml-2 italic text-[11px]">
          {`// @${username} · last 52 weeks`}
        </span>
      </p>

      {isLoading && (
        <p className="font-mono text-[11px] text-mute py-8">
          fetching public contribution activity...
        </p>
      )}

      {isError && (
        <p className="font-mono text-[11px] text-mute py-4">
          contribution activity unavailable ·{" "}
          <a
            href={`https://github.com/${username}`}
            target="_blank"
            rel="noreferrer"
            className="text-signal hover:underline"
          >
            open GitHub profile
          </a>
        </p>
      )}

      {data && weeks.length > 0 && (
        <>
          <HeatmapGrid
            weeks={weeks}
            months={months}
            formatTooltip={(cell) =>
              `${cell.date}: ${cell.count} contribution${cell.count !== 1 ? "s" : ""}`
            }
          />
          <div className="mt-2 flex items-center justify-between gap-4 font-mono text-[10px] text-mute">
            <span>{data.total.toLocaleString()} contributions in the last year</span>
            <a
              href={`https://github.com/${username}`}
              target="_blank"
              rel="noreferrer"
              className="shrink-0 text-signal hover:underline"
            >
              @{username} ↗
            </a>
          </div>
        </>
      )}
    </div>
  )
}

export default GitHubContributions
