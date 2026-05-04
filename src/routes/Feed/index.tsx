import { useMemo } from "react"
import styled from "@emotion/styled"
import LineNumberGutter from "src/layouts/RootLayout/EditorChrome/LineNumberGutter"
import { useRegisterChrome } from "src/layouts/RootLayout/EditorChrome/RouteChromeContext"
import HomeHero from "./HomeHero"
import StatsGrid from "./StatsGrid"
import EditorialPostList from "./EditorialPostList"
import ActivityGrid from "src/components/ActivityGrid"
import usePostsQuery from "src/hooks/usePostsQuery"
import { getStats, getActivityGrid } from "src/libs/utils/stats"

const Feed = () => {
  const posts = usePostsQuery()
  const stats = getStats(posts)
  const activityGrid = getActivityGrid(posts)

  const statusItems = useMemo(
    () => ["main", "✓ synced", `${stats.posts} entries`, "UTF-8", "LF", "Markdown"],
    [stats.posts]
  )
  useRegisterChrome("README.md", statusItems)

  return (
    <StyledWrapper>
      <div className="scroll-area">
        <div className="content-grid">
          <LineNumberGutter count={120} />
          <div className="body">
            <HomeHero />

            <StatsGrid stats={stats} />

            <div className="activity-section">
              <div className="activity-header">
                <h2>## writing.activity</h2>
                <span>last 26 weeks</span>
              </div>
              <ActivityGrid grid={activityGrid} />
            </div>

            <EditorialPostList />
          </div>
        </div>
      </div>
    </StyledWrapper>
  )
}

export default Feed

const StyledWrapper = styled.div`
  display: flex;
  flex-direction: column;
  flex: 1;
  min-height: 0;
  overflow: hidden;

  .scroll-area {
    flex: 1;
    overflow-y: auto;
    overflow-x: hidden;
    scrollbar-width: none;
    &::-webkit-scrollbar { display: none; }
  }

  .content-grid {
    display: grid;
    grid-template-columns: ${({ theme }) => theme.variables.gutterWidth}px 1fr;
    min-height: 100%;

    @media (max-width: ${({ theme }) => theme.variables.breakpoint}px) {
      grid-template-columns: 1fr;
    }
  }

  .body {
    padding: 30px 44px 80px;
    max-width: 920px;

    @media (max-width: ${({ theme }) => theme.variables.breakpoint}px) {
      padding: 20px 20px 60px;
    }
  }

  .activity-section {
    margin-bottom: 40px;

    .activity-header {
      display: flex;
      justify-content: space-between;
      align-items: baseline;
      margin-bottom: 12px;

      h2 {
        font-family: var(--font-mono, monospace);
        font-size: 13px;
        color: ${({ theme }) => theme.colors.editor.fg3};
        font-weight: 500;
        margin: 0;
        letter-spacing: 1.2px;
        text-transform: uppercase;
      }

      span {
        font-size: 11px;
        color: ${({ theme }) => theme.colors.editor.fg3};
        font-family: var(--font-mono, monospace);
      }
    }
  }
`
