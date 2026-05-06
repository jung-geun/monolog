import React, { useMemo } from "react"
import styled from "@emotion/styled"
import NotionRenderer from "../components/NotionRenderer"
import usePostQuery from "src/hooks/usePostQuery"
import LineNumberGutter from "src/layouts/RootLayout/EditorChrome/LineNumberGutter"
import { useRegisterChrome } from "src/layouts/RootLayout/EditorChrome/RouteChromeContext"
import { CONFIG } from "site.config"
import ActivityHeatmap from "./components/ActivityHeatmap"
import ContactBlock from "./components/ContactBlock"
import StackGrid from "./components/StackGrid"

const aboutSlug = (CONFIG as any).aboutSlug ?? "about"

const PageDetail: React.FC = () => {
  const data = usePostQuery()

  const isAbout = data?.slug === aboutSlug
  const filename = isAbout ? "about.md" : `${data?.slug ?? "page"}.md`
  const statusItems = useMemo(
    () => ["main", filename, "Markdown"],
    [filename]
  )
  useRegisterChrome(filename, statusItems)

  if (!data) return null

  return (
    <StyledWrapper>
      <div className="scroll-area">
        <div className="content-grid">
          <LineNumberGutter count={80} />
          <div className="body">
            {isAbout && (
              <>
                {/* YAML frontmatter */}
                <div className="font-mono text-[13px] space-y-0.5 mb-6">
                  <p className="text-mute">---</p>
                  <p>
                    <span className="text-signal-200">author</span>
                    <span className="text-mute">{": "}</span>
                    <span className="text-zinc-300">{CONFIG.profile.name}</span>
                  </p>
                  <p>
                    <span className="text-signal-200">role</span>
                    <span className="text-mute">{": "}</span>
                    <span className="text-zinc-300">{CONFIG.profile.role}</span>
                  </p>
                  <p>
                    <span className="text-signal-200">bio</span>
                    <span className="text-mute">{": "}</span>
                    <span className="text-zinc-300">{CONFIG.profile.bio}</span>
                  </p>
                  <p className="text-mute">---</p>
                </div>

                <ActivityHeatmap />
                <StackGrid />
                <ContactBlock />

                <hr className="border-hairline mb-6" />
              </>
            )}
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
