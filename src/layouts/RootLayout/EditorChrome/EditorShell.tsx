import React, { ReactNode } from "react"
import styled from "@emotion/styled"
import ActivityBar from "./ActivityBar"
import FileTree from "./FileTree"
import TitleBar from "./TitleBar"
import StatusBar from "./StatusBar"
import { RouteChromeProvider, useRouteChrome } from "./RouteChromeContext"

const EditorShellInner = ({ children }: { children: ReactNode }) => {
  const { chrome } = useRouteChrome()
  return (
    <StyledWrapper>
      <TitleBar filename={chrome.filename} />
      <div className="main-row">
        <ActivityBar />
        <FileTree />
        <div className="editor-body">
          {children}
        </div>
      </div>
      <StatusBar items={chrome.statusItems} />
    </StyledWrapper>
  )
}

const EditorShell = ({ children }: { children: ReactNode }) => (
  <RouteChromeProvider>
    <EditorShellInner>{children}</EditorShellInner>
  </RouteChromeProvider>
)

export default EditorShell

const StyledWrapper = styled.div`
  position: fixed;
  inset: 0;
  display: flex;
  flex-direction: column;
  background: ${({ theme }) => theme.colors.editor.bg};
  color: ${({ theme }) => theme.colors.editor.fg};
  font-family: var(--font-mono, monospace);
  overflow: hidden;

  .main-row {
    flex: 1;
    display: flex;
    min-height: 0;
    overflow: hidden;
  }

  .editor-body {
    flex: 1;
    min-width: 0;
    display: flex;
    flex-direction: column;
    overflow: hidden;
  }
`
