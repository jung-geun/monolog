import React, { useMemo } from "react"
import styled from "@emotion/styled"
import NotionRenderer from "../components/NotionRenderer"
import usePostQuery from "src/hooks/usePostQuery"
import LineNumberGutter from "src/layouts/RootLayout/EditorChrome/LineNumberGutter"
import { useRegisterChrome } from "src/layouts/RootLayout/EditorChrome/RouteChromeContext"

const PageDetail: React.FC = () => {
  const data = usePostQuery()

  const statusItems = useMemo(() => ["main", "about.md", "Markdown"], [])
  useRegisterChrome("about.md", statusItems)

  if (!data) return null

  return (
    <StyledWrapper>
      <div className="scroll-area">
        <div className="content-grid">
          <LineNumberGutter count={80} />
          <div className="body">
            <NotionRenderer recordMap={data.recordMap} />
          </div>
        </div>
      </div>
    </StyledWrapper>
  )
}

export default PageDetail

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
    padding: 40px 56px 60px;
    max-width: 760px;
    min-width: 0;

    @media (max-width: ${({ theme }) => theme.variables.breakpoint}px) {
      padding: 24px 20px 60px;
    }
  }
`
