import { useMemo } from "react"
import Link from "next/link"
import styled from "@emotion/styled"
import usePostsQuery from "src/hooks/usePostsQuery"
import { useSeriesQuery } from "src/hooks/useSeriesQuery"
import TabBar from "src/layouts/RootLayout/EditorChrome/TabBar"
import { useRegisterChrome } from "src/layouts/RootLayout/EditorChrome/RouteChromeContext"

type Props = {
  seriesName: string
}

const SeriesArchive = ({ seriesName }: Props) => {
  const allPosts = usePostsQuery()
  const series = useSeriesQuery()

  const posts = allPosts.filter(
    (p) => p.series && p.series.includes(seriesName)
  )

  const byYear: Record<string, typeof posts> = {}
  for (const post of posts) {
    const year = (post.date?.start_date || post.createdTime || "").slice(0, 4) || "—"
    if (!byYear[year]) byYear[year] = []
    byYear[year].push(post)
  }
  const years = Object.keys(byYear).sort((a, b) => Number(b) - Number(a))

  const filename = `series/${seriesName}.md`
  const tabs = [{ label: `§${seriesName}`, href: `/series/${seriesName}`, icon: "§" }]

  const statusItems = useMemo(
    () => ["main", `series: ${seriesName}`, `${posts.length} entries`, "Markdown"],
    [seriesName, posts.length]
  )
  useRegisterChrome(filename, statusItems)

  const seriesNames = Object.keys(series)

  return (
    <StyledWrapper>
      <TabBar tabs={tabs} activeIdx={0} />

      <div className="scroll-area">
        <div className="body">
          <div className="breadcrumb">
            <span className="home">~</span> /{" "}
            <Link href="/series" className="breadcrumb-link">series</Link> /{" "}
            <span className="current">{seriesName}</span>
          </div>

          <h1 className="series-title">
            §{seriesName}
          </h1>
          <p className="sub">
            <span className="comment">{"// "}</span>
            {posts.length} entries in this series.
          </p>

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

          <div className="timeline">
            <div className="timeline-axis" />
            {years.map((year) => (
              <div key={year} className="year-group">
                <div className="year-header">
                  <div className="year-label">{year}</div>
                  <div className="year-line" />
                </div>
                {byYear[year].map((post) => {
                  const dateOnly = (post.date?.start_date || post.createdTime || "").slice(0, 10)
                  const monthDay = dateOnly.slice(5).replace("-", "/")
                  return (
                    <Link key={post.id} href={`/${post.slug}`} className="timeline-item">
                      <div className="item-date">{monthDay}</div>
                      <div className="item-dot" />
                      <div className="item-content">
                        <div className="item-title">{post.title}</div>
                        {post.summary && (
                          <div className="item-summary">{post.summary}</div>
                        )}
                        {post.tags && (
                          <div className="item-tags">
                            {post.tags.map((t) => `#${t}`).join(" · ")}
                          </div>
                        )}
                      </div>
                    </Link>
                  )
                })}
              </div>
            ))}
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
    max-width: 1000px;

    @media (max-width: ${({ theme }) => theme.variables.breakpoint}px) {
      padding: 20px 20px;
    }
  }

  .breadcrumb {
    font-family: var(--font-mono, monospace);
    font-size: 12px;
    color: ${({ theme }) => theme.colors.editor.fg3};
    margin-bottom: 12px;

    .home { color: ${({ theme }) => theme.colors.editor.accent3}; }
    .current { color: ${({ theme }) => theme.colors.editor.accent}; }
    .breadcrumb-link {
      color: ${({ theme }) => theme.colors.editor.fg2};
      text-decoration: none;
      &:hover { color: ${({ theme }) => theme.colors.editor.accent}; }
    }
  }

  .series-title {
    font-family: var(--font-mono, monospace);
    font-size: clamp(32px, 5vw, 56px);
    font-weight: 500;
    margin: 0 0 6px;
    color: ${({ theme }) => theme.colors.editor.fg};
    line-height: 1.0;
    letter-spacing: -0.01em;

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
    margin: 8px 0 24px;

    .comment { color: ${({ theme }) => theme.colors.editor.fg3}; }
  }

  .series-nav {
    display: flex;
    gap: 6px;
    flex-wrap: wrap;
    margin-bottom: 28px;
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

  .timeline {
    position: relative;

    .timeline-axis {
      position: absolute;
      left: 75px;
      top: 8px;
      bottom: 8px;
      width: 1px;
      background: ${({ theme }) => theme.colors.editor.line2};
    }
  }

  .year-group {
    margin-bottom: 28px;

    .year-header {
      display: grid;
      grid-template-columns: 62px 1fr;
      align-items: center;
      margin-bottom: 12px;
      gap: 16px;

      .year-label {
        font-family: var(--font-mono, monospace);
        font-size: 24px;
        font-weight: 500;
        color: ${({ theme }) => theme.colors.editor.fg3};
        text-align: right;
      }

      .year-line {
        height: 1px;
        background: ${({ theme }) => theme.colors.editor.line};
      }
    }
  }

  .timeline-item {
    display: grid;
    grid-template-columns: 62px 16px 1fr;
    gap: 16px;
    align-items: baseline;
    padding: 10px 0;
    text-decoration: none;
    color: inherit;

    &:hover .item-title { color: ${({ theme }) => theme.colors.editor.accent3}; }

    .item-date {
      font-family: var(--font-mono, monospace);
      font-size: 12px;
      color: ${({ theme }) => theme.colors.editor.fg3};
      text-align: right;
    }

    .item-dot {
      width: 9px;
      height: 9px;
      border-radius: 50%;
      background: ${({ theme }) => theme.colors.editor.accent};
      border: 2px solid ${({ theme }) => theme.colors.editor.bg};
      box-shadow: 0 0 0 1px ${({ theme }) => theme.colors.editor.line2};
      justify-self: center;
      align-self: center;
      flex-shrink: 0;
    }

    .item-content {
      min-width: 0;

      .item-title {
        font-family: var(--font-mono, monospace);
        font-size: 18px;
        color: ${({ theme }) => theme.colors.editor.fg};
        line-height: 1.3;
        transition: color 0.15s;
      }

      .item-summary {
        font-family: var(--font-mono, monospace);
        font-size: 11px;
        color: ${({ theme }) => theme.colors.editor.fg2};
        margin-top: 4px;
        line-height: 1.5;
      }

      .item-tags {
        font-family: var(--font-mono, monospace);
        font-size: 10px;
        color: ${({ theme }) => theme.colors.editor.fg3};
        margin-top: 4px;
      }
    }
  }
`
