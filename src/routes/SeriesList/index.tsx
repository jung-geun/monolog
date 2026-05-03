import { useMemo } from "react"
import Link from "next/link"
import styled from "@emotion/styled"
import usePostsQuery from "src/hooks/usePostsQuery"
import { useSeriesQuery } from "src/hooks/useSeriesQuery"
import TabBar from "src/layouts/RootLayout/EditorChrome/TabBar"
import { useRegisterChrome } from "src/layouts/RootLayout/EditorChrome/RouteChromeContext"

const SeriesList = () => {
  const allPosts = usePostsQuery()
  const series = useSeriesQuery()

  const seriesEntries = Object.entries(series).sort((a, b) => b[1] - a[1])

  const statusItems = useMemo(
    () => ["main", "series", `${seriesEntries.length} series`, "Markdown"],
    [seriesEntries.length]
  )
  useRegisterChrome("series.md", statusItems)

  const tabs = [{ label: "series", href: "/series", icon: "§" }]

  const latestBySeriesName: Record<string, string> = {}
  for (const post of allPosts) {
    const s = post.series?.[0]
    if (s && !latestBySeriesName[s]) {
      latestBySeriesName[s] = post.title
    }
  }

  return (
    <StyledWrapper>
      <TabBar tabs={tabs} activeIdx={0} />

      <div className="scroll-area">
        <div className="body">
          <div className="breadcrumb">
            <span className="home">~</span> / series
          </div>

          <h1 className="page-title">
            § series
          </h1>
          <p className="sub">
            <span className="comment">{"// "}</span>
            {seriesEntries.length} series · {allPosts.filter((p) => p.series).length} entries
          </p>

          {seriesEntries.length === 0 ? (
            <div className="empty">no series yet.</div>
          ) : (
            <div className="series-grid">
              {seriesEntries.map(([name, count]) => (
                <Link key={name} href={`/series/${name}`} className="series-card">
                  <div className="card-icon">§</div>
                  <div className="card-body">
                    <div className="card-name">{name}</div>
                    <div className="card-meta">{count} entries</div>
                    {latestBySeriesName[name] && (
                      <div className="card-latest">{latestBySeriesName[name]}</div>
                    )}
                  </div>
                </Link>
              ))}
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
  }

  .page-title {
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
    margin: 8px 0 32px;

    .comment { color: ${({ theme }) => theme.colors.editor.fg3}; }
  }

  .empty {
    font-family: var(--font-mono, monospace);
    font-size: 13px;
    color: ${({ theme }) => theme.colors.editor.fg3};
    padding: 24px 0;
  }

  .series-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(260px, 1fr));
    gap: 12px;
  }

  .series-card {
    display: flex;
    gap: 14px;
    align-items: flex-start;
    padding: 16px 18px;
    border: 1px solid ${({ theme }) => theme.colors.editor.line};
    background: ${({ theme }) => theme.colors.editor.bg2};
    text-decoration: none;
    color: inherit;
    transition: border-color 0.15s;

    &:hover {
      border-color: ${({ theme }) => theme.colors.editor.accent};
    }

    .card-icon {
      font-family: var(--font-mono, monospace);
      font-size: 18px;
      color: ${({ theme }) => theme.colors.editor.accent};
      flex-shrink: 0;
      line-height: 1;
      margin-top: 2px;
    }

    .card-body {
      min-width: 0;
    }

    .card-name {
      font-family: var(--font-mono, monospace);
      font-size: 16px;
      font-weight: 500;
      color: ${({ theme }) => theme.colors.editor.fg};
      margin-bottom: 4px;
    }

    .card-meta {
      font-family: var(--font-mono, monospace);
      font-size: 11px;
      color: ${({ theme }) => theme.colors.editor.fg3};
      margin-bottom: 6px;
    }

    .card-latest {
      font-family: var(--font-mono, monospace);
      font-size: 11px;
      color: ${({ theme }) => theme.colors.editor.fg2};
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
  }
`
