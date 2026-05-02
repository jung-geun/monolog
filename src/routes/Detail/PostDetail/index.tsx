import { useMemo } from "react"
import styled from "@emotion/styled"
import React from "react"
import usePostQuery from "src/hooks/usePostQuery"
import NotionRenderer from "../components/NotionRenderer"
import Footer from "./PostFooter"
import Frontmatter from "src/components/Frontmatter"
import ReadingProgress from "./ReadingProgress"
import RightRail from "./RightRail"
import LineNumberGutter from "src/layouts/RootLayout/EditorChrome/LineNumberGutter"
import TabBar from "src/layouts/RootLayout/EditorChrome/TabBar"
import { useRegisterChrome } from "src/layouts/RootLayout/EditorChrome/RouteChromeContext"

const PostDetail: React.FC = () => {
  const data = usePostQuery()

  const filename = data ? `${data.slug}.md` : "loading.md"
  const statusItems = useMemo(() => ["main", "Reading", "Markdown"], [])
  useRegisterChrome(filename, statusItems)

  if (!data) return null

  const category = data.category?.[0] || undefined
  const dateStr = data.date?.start_date || data.createdTime?.slice(0, 10) || ""

  const tabs = [
    { label: "README.md", href: "/" },
    { label: filename, href: `/${data.slug}` },
  ]

  return (
    <StyledWrapper>
      <TabBar tabs={tabs} activeIdx={1} />
      <ReadingProgress />

      <div className="scroll-area">
        <div className="content-grid">
          <LineNumberGutter count={120} />
          <div className="body">
            <Frontmatter
              title={data.title}
              date={dateStr}
              category={category}
              tags={data.tags}
            />

            <h1 className="post-title">{data.title}</h1>

            <div className="notion-content">
              <NotionRenderer recordMap={data.recordMap} />
            </div>

            <Footer />
          </div>
          <RightRail recordMap={data.recordMap} post={data} />
        </div>
      </div>
    </StyledWrapper>
  )
}

export default PostDetail

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
    grid-template-columns: ${({ theme }) => theme.variables.gutterWidth}px 1fr 240px;
    min-height: 100%;

    @media (max-width: ${({ theme }) => theme.variables.breakpoint}px) {
      grid-template-columns: 1fr;
    }
  }

  .body {
    padding: 40px 56px 60px;
    max-width: 760px;
    min-width: 0;

    @media (max-width: ${({ theme }) => theme.variables.breakpoint}px) {
      padding: 24px 20px 60px;
    }
  }

  .post-title {
    font-family: var(--font-mono, monospace);
    font-size: clamp(24px, 3vw, 36px);
    font-weight: 500;
    font-style: normal;
    margin: 0 0 24px;
    color: ${({ theme }) => theme.colors.editor.fg};
    line-height: 1.2;
    letter-spacing: -0.01em;

    &::before {
      content: "# ";
      color: ${({ theme }) => theme.colors.editor.accent};
      font-weight: 400;
    }
  }

  .notion-content {
    .notion-page { padding: 0 !important; }

    code, .notion-inline-code {
      background: ${({ theme }) => theme.colors.editor.bg2};
      color: ${({ theme }) => theme.colors.editor.accent};
      border-radius: 2px;
      padding: 1px 5px;
      font-family: var(--font-mono, monospace);
    }
  }
`
