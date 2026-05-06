import { useMemo } from "react"
import styled from "@emotion/styled"
import LineNumberGutter from "src/layouts/RootLayout/EditorChrome/LineNumberGutter"
import { useRegisterChrome } from "src/layouts/RootLayout/EditorChrome/RouteChromeContext"
import HomeHero from "./HomeHero"
import FeaturedSeriesGrid from "./FeaturedSeriesGrid"
import RecentPostsCompact from "./RecentPostsCompact"
import usePostsQuery from "src/hooks/usePostsQuery"

const Feed = () => {
  const posts = usePostsQuery()

  const statusItems = useMemo(
    () => ["main", "✓ synced", `${posts.length} entries`, "UTF-8", "LF", "Markdown"],
    [posts.length]
  )
  useRegisterChrome("README.md", statusItems)

  return (
    <StyledWrapper>
      <div className="scroll-area">
        <div className="content-grid">
          <LineNumberGutter count={120} />
          <div className="body">
            <HomeHero />

            <FeaturedSeriesGrid />

            <RecentPostsCompact />
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

`
