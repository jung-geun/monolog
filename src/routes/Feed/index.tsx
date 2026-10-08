import { useMemo } from "react"
import styled from "@emotion/styled"
import { useRegisterChrome } from "src/layouts/RootLayout/EditorChrome/RouteChromeContext"
import HomeHero from "./HomeHero"
import FeaturedSeriesGrid from "./FeaturedSeriesGrid"
import RecentPostsCompact from "./RecentPostsCompact"
import TagCloud from "src/components/TagCloud"
import usePostsQuery from "src/hooks/usePostsQuery"

const Feed = () => {
  const posts = usePostsQuery()

  const statusItems = useMemo(
    () => ["main", "✓ synced", `${posts.length} entries`, "UTF-8", "LF", "Markdown"],
    [posts.length]
  )
  useRegisterChrome("README.md", statusItems, "readme")

  return (
    <StyledWrapper>
      <div className="body">
        <HomeHero />

        <FeaturedSeriesGrid />

        <RecentPostsCompact />

        <TagCloud />
      </div>
    </StyledWrapper>
  )
}

export default Feed

const StyledWrapper = styled.div`
  flex: 1;
  overflow-x: clip;

  .body {
    padding: 36px 44px 80px;
    max-width: 840px;

    @media (max-width: ${({ theme }) => theme.variables.breakpoint}px) {
      padding: 24px 20px 60px;
    }
  }
`
