import { useMemo } from "react"
import Link from "next/link"
import styled from "@emotion/styled"
import usePostsQuery from "src/hooks/usePostsQuery"
import { useSeriesQuery } from "src/hooks/useSeriesQuery"
import { useRegisterChrome } from "src/layouts/RootLayout/EditorChrome/RouteChromeContext"

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

const SeriesList = () => {
  const allPosts = usePostsQuery()
  const series = useSeriesQuery()

  const seriesEntries = Object.entries(series).sort((a, b) => b[1] - a[1])

  const statusItems = useMemo(
    () => ["main", "series", `${seriesEntries.length} series`, "Markdown"],
    [seriesEntries.length]
  )
  useRegisterChrome("series.md", statusItems)

  const latestBySeriesName: Record<string, string> = {}
  for (const post of allPosts) {
    const s = post.series?.[0]
    if (s && !latestBySeriesName[s]) {
      latestBySeriesName[s] = post.title
    }
  }

  return (
    <StyledWrapper>
      <div className="scroll-area">
        <div className="body">
          {/* YAML frontmatter */}
          <div className="font-mono text-[13px] space-y-0.5 mb-6">
            <p className="text-mute">---</p>
            <p><span className="text-signal-200">view</span><span className="text-mute">: </span><span className="text-zinc-300">series</span></p>
            <p><span className="text-signal-200">count</span><span className="text-mute">: </span><span className="text-zinc-300">{seriesEntries.length}</span></p>
            <p className="text-mute">---</p>
          </div>

          <h1 className="page-title">§ series</h1>
          <p className="sub">
            <span className="comment">{"// "}</span>
            {seriesEntries.length} series · {allPosts.filter((p) => p.series).length} entries
          </p>

          {seriesEntries.length === 0 ? (
            <div className="empty">no series yet.</div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-4">
              {seriesEntries.map(([name, count]) => {
                const color = pickColor(name)
                return (
                  <Link
                    key={name}
                    href={`/series/${name}`}
                    className="group flex items-center gap-3 rounded-md border border-hairline bg-card/60 p-3 transition-colors hover:border-signal/45 hover:bg-card/85"
                  >
                    <span className={`grid h-10 w-10 shrink-0 place-items-center rounded font-mono text-base font-medium text-zinc-50 ${GRADIENTS[color]}`}>
                      §
                    </span>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-[14px] text-zinc-100 truncate mb-0.5">{name}</p>
                      <p className="font-mono text-[10px] text-mute">
                        {count} entries{count >= 10 ? " · ongoing" : ""}
                      </p>
                      {latestBySeriesName[name] && (
                        <p className="font-mono text-[10px] text-soft truncate mt-0.5">
                          {latestBySeriesName[name]}
                        </p>
                      )}
                    </div>
                    <span className="font-mono text-xs text-mute transition-colors group-hover:text-signal-200 shrink-0">
                      →
                    </span>
                  </Link>
                )
              })}
            </div>
          )}
        </div>
      </div>
    </StyledWrapper>
  )
}

export default SeriesList

const StyledWrapper = styled.div`
  display: flex;
  flex-direction: column;
  flex: 1;
  min-height: 0;
  overflow: hidden;

  .scroll-area {
    flex: 1;
    overflow-y: auto;
    scrollbar-width: none;
    &::-webkit-scrollbar { display: none; }
  }

  .body {
    padding: 36px 56px;
    max-width: 900px;

    @media (max-width: ${({ theme }) => theme.variables.breakpoint}px) {
      padding: 20px 20px;
    }
  }

  .page-title {
    font-family: var(--font-mono, monospace);
    font-size: clamp(28px, 4vw, 48px);
    font-weight: 500;
    margin: 0 0 6px;
    color: ${({ theme }) => theme.colors.editor.fg};
    line-height: 1.0;

    &::before {
      content: "# ";
      color: ${({ theme }) => theme.colors.editor.accent};
      font-weight: 400;
    }
  }

  .sub {
    font-family: var(--font-mono, monospace);
    font-size: 13px;
    color: ${({ theme }) => theme.colors.editor.fg2};
    line-height: 1.7;
    margin: 8px 0 0;

    .comment { color: ${({ theme }) => theme.colors.editor.fg3}; }
  }

  .empty {
    font-family: var(--font-mono, monospace);
    font-size: 13px;
    color: ${({ theme }) => theme.colors.editor.fg3};
    padding: 24px 0;
  }
`
