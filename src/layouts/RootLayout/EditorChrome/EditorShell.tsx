import React, { ReactNode } from "react"
import styled from "@emotion/styled"
import ActivityBar from "./ActivityBar"
import FileTree from "./FileTree"
import TabBar from "./TabBar"
import TitleBar from "./TitleBar"
import StatusBar from "./StatusBar"
import { RouteChromeProvider, useRouteChrome } from "./RouteChromeContext"

const EditorShellInner = ({ children }: { children: ReactNode }) => {
  const { chrome, isFileTreeOpen, setFileTreeOpen } = useRouteChrome()
  return (
    <StyledWrapper>
      <TitleBar filename={chrome.filename} />
      <div className="main-row">
        <ActivityBar />
        <FileTree />
        <div
          className={`filetree-backdrop${isFileTreeOpen ? " open" : ""}`}
          onClick={() => setFileTreeOpen(false)}
          aria-hidden="true"
        />
        <div className="editor-body">
          <TabBar />
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
    position: relative;
  }

  .editor-body {
    flex: 1;
    min-width: 0;
    display: flex;
    flex-direction: column;
    overflow: hidden;
  }

  .filetree-backdrop {
    display: none;
  }

  @media (max-width: ${({ theme }) => theme.variables.breakpoint}px) {
    .filetree-backdrop {
      display: block;
      position: absolute;
      top: 0;
      left: ${({ theme }) => theme.variables.activityBarWidth}px;
      right: 0;
      bottom: 0;
      background: rgba(0, 0, 0, 0.45);
      z-index: 15;
      opacity: 0;
      pointer-events: none;
      transition: opacity 0.18s ease;

      &.open {
        opacity: 1;
        pointer-events: auto;
        cursor: pointer;
      }
    }
  }
`
