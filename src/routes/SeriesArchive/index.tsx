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

const ACCENT_NUM: Record<Color, string> = {
  signal:   "text-signal/70",
  paper:    "text-paper/70",
  cs:       "text-cs/70",
  research: "text-research/70",
}

const ACCENT_LABEL: Record<Color, string> = {
  signal:   "text-signal-900 dark:text-signal-200",
  paper:    "text-paper-900 dark:text-paper-50",
  cs:       "text-cs-900 dark:text-cs-50",
  research: "text-research-900 dark:text-research-50",
}

function pickColor(name: string): Color {
  let h = 0
  for (let i = 0; i < name.length; i++) h += name.charCodeAt(i)
  return COLORS[h % COLORS.length]
}

type Props = {
  seriesName: string
}

const SeriesArchive = ({ seriesName }: Props) => {
  const allPosts = usePostsQuery()
  const series = useSeriesQuery()

  const posts = allPosts
    .filter((p) => p.series && p.series.includes(seriesName))
    .sort((a, b) => {
      const da = (a.date?.start_date || a.createdTime || "")
      const db = (b.date?.start_date || b.createdTime || "")
      return da < db ? -1 : da > db ? 1 : 0
    })

  const filename = `series/${seriesName}.md`
  const statusItems = useMemo(
    () => ["main", `series: ${seriesName}`, `${posts.length} entries`, "Markdown"],
    [seriesName, posts.length]
  )
  useRegisterChrome(filename, statusItems)

  const seriesNames = Object.keys(series)
  const color = pickColor(seriesName)

  return (
    <StyledWrapper>
      <div className="scroll-area">
        <div className="body">
          {/* YAML frontmatter */}
          <div className="font-mono text-[13px] space-y-0.5 mb-6">
            <p className="text-mute">---</p>
            <p><span className="text-signal-900 dark:text-signal-200">view</span><span className="text-mute">: </span><span className="text-strong">series</span></p>
            <p><span className="text-signal-900 dark:text-signal-200">name</span><span className="text-mute">: </span><span className="text-strong">{seriesName}</span></p>
            <p><span className="text-signal-900 dark:text-signal-200">count</span><span className="text-mute">: </span><span className="text-strong">{posts.length}</span></p>
            <p className="text-mute">---</p>
          </div>

          {/* Series header card */}
          <div className="flex items-start gap-3 mb-6">
            <span className={`grid h-12 w-12 shrink-0 place-items-center rounded-md font-mono text-xl font-medium text-zinc-50 ${GRADIENTS[color]}`}>
              §
            </span>
            <div>
              <p className={`font-mono text-[10px] tracking-widest ${ACCENT_LABEL[color]}`}>
                SERIES · {posts.length} ENTRIES
              </p>
              <h1 className="text-2xl font-medium text-strong">{seriesName}</h1>
            </div>
          </div>

          {/* Series nav chips */}
          <div className="series-nav">
            {seriesNames.map((name) => (
              <Link
                key={name}
                href={`/series/${name}`}
                className={`series-chip${name === seriesName ? " active" : ""}`}
              >
                {name} <span className="count">{series[name]}</span>
              </Link>
            ))}
          </div>

          {/* Reading order comment */}
          <p className="font-mono text-[12px] text-mute italic mb-3">{"// in reading order"}</p>

          {/* Numbered post list */}
          <div className="space-y-1.5">
            {posts.map((post, i) => {
              const dateOnly = (post.date?.start_date || post.createdTime || "").slice(0, 10)
              return (
                <Link
                  key={post.id}
                  href={`/${post.slug}`}
                  className="group flex items-start gap-3 rounded-md border border-hairline bg-card/60 p-3 transition-colors hover:border-signal/45 hover:bg-card/85"
                >
                  <span className={`font-mono text-base font-medium shrink-0 w-7 text-right tabular-nums ${ACCENT_NUM[color]}`}>
                    {String(i).padStart(2, "0")}
                  </span>
                  <div className="flex-1 min-w-0">
                    <h3 className="text-[14px] font-medium text-strong leading-snug line-clamp-2 mb-1">
                      {post.title}
                    </h3>
                    {post.summary && (
                      <p className="text-[12px] text-soft line-clamp-2 mb-1.5">{post.summary}</p>
                    )}
                    <p className="font-mono text-[10px] text-mute">{dateOnly}</p>
                  </div>
                  <span className="font-mono text-xs text-mute transition-colors group-hover:text-signal dark:group-hover:text-signal-200 shrink-0">
                    →
                  </span>
                </Link>
              )
            })}
          </div>
        </div>
      </div>
    </StyledWrapper>
  )
}

export default SeriesArchive

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

  .series-nav {
    display: flex;
    gap: 6px;
    flex-wrap: wrap;
    margin-bottom: 20px;
    padding-bottom: 18px;
    border-bottom: 1px solid ${({ theme }) => theme.colors.editor.line};

    .series-chip {
      font-family: var(--font-mono, monospace);
      font-size: 11px;
      padding: 4px 10px;
      background: ${({ theme }) => theme.colors.editor.bg2};
      color: ${({ theme }) => theme.colors.editor.fg2};
      border: 1px solid ${({ theme }) => theme.colors.editor.line};
      text-decoration: none;

      .count { color: ${({ theme }) => theme.colors.editor.fg3}; }

      &.active {
        background: ${({ theme }) => theme.colors.editor.accent};
        color: #fff;
        border-color: ${({ theme }) => theme.colors.editor.accent};
        .count { color: rgba(255,255,255,0.8); }
      }

      &:hover:not(.active) {
        border-color: ${({ theme }) => theme.colors.editor.accent};
        color: ${({ theme }) => theme.colors.editor.accent};
      }
    }
  }
`
