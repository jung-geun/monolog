import React, { ReactNode, useEffect, useRef, useState } from "react"
import styled from "@emotion/styled"
import { useRouter } from "next/compat/router"
import Router from "next/router"
import ActivityBar from "./ActivityBar"
import FileTree from "./FileTree"
import TabBar from "./TabBar"
import TitleBar from "./TitleBar"
import StatusBar from "./StatusBar"
import { RouteChromeProvider, useRouteChrome } from "./RouteChromeContext"

const EditorShellInner = ({ children }: { children: ReactNode }) => {
  const { chrome, isFileTreeOpen, setFileTreeOpen } = useRouteChrome()
  const events = useRouter()?.events
  const contentRef = useRef<HTMLDivElement>(null)
  const [navigation, setNavigation] = useState<"idle" | "loading" | "complete">("idle")

  useEffect(() => {
    if (!events) return
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)")
    let currentRoute = window.location.pathname + window.location.search
    let pendingRoute: string | null = null
    let historyTarget: string | null = null
    let skipEntry = false
    let entryAnimation: Animation | undefined

    const cancelEntry = () => {
      entryAnimation?.cancel()
      entryAnimation = undefined
    }
    const start = (url: string, { shallow }: { shallow: boolean }) => {
      const route = url.split("#")[0]
      const fromHistory = historyTarget === route
      historyTarget = null
      if (shallow || route === currentRoute) return
      skipEntry = fromHistory
      pendingRoute = url
      cancelEntry()
      setNavigation("loading")
    }
    const complete = (url: string) => {
      currentRoute = url.split("#")[0]
      if (pendingRoute === null) return
      pendingRoute = null
      setNavigation("complete")
      // History traversal and anchor targets must not replay document entry.
      if (reducedMotion.matches || skipEntry || url.includes("#") || window.scrollY > 80) return
      entryAnimation = contentRef.current?.animate([
        { opacity: 0.84, transform: "translateY(8px)" },
        { opacity: 1, transform: "none" },
      ], { duration: 320, easing: "cubic-bezier(0.22, 1, 0.36, 1)" })
    }
    const fail = (_error: unknown, url: string) => {
      if (pendingRoute !== url) return
      pendingRoute = null
      cancelEntry()
      setNavigation("idle")
    }
    const preferenceChanged = () => {
      if (reducedMotion.matches) cancelEntry()
    }

    // The Router owns popstate; mark history before it emits routeChangeStart.
    Router.beforePopState(({ as }) => {
      historyTarget = as.split("#")[0]
      return true
    })
    events.on("routeChangeStart", start)
    events.on("routeChangeComplete", complete)
    events.on("routeChangeError", fail)
    reducedMotion.addEventListener("change", preferenceChanged)
    return () => {
      Router.beforePopState(() => true)
      events.off("routeChangeStart", start)
      events.off("routeChangeComplete", complete)
      events.off("routeChangeError", fail)
      reducedMotion.removeEventListener("change", preferenceChanged)
      cancelEntry()
    }
  }, [events])

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
          <div className="route-signal" data-navigation={navigation} aria-hidden="true" />
          <div className="page-content" ref={contentRef} aria-busy={navigation === "loading"}>
            {children}
          </div>
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
  display: flex;
  flex-direction: column;
  min-height: 100vh;
  min-height: 100dvh;
  background: ${({ theme }) => theme.colors.editor.bg};
  color: ${({ theme }) => theme.colors.editor.fg};
  font-family: var(--font-mono, monospace);

  .main-row {
    flex: 1;
    display: flex;
    position: relative;
  }

  .editor-body {
    flex: 1;
    min-width: 0;
    display: flex;
    flex-direction: column;
  }

  .page-content {
    flex: 1;
    min-width: 0;
    display: flex;
    flex-direction: column;
    animation: monolog-page-reveal 360ms var(--motion-ease);
  }

  .route-signal {
    position: sticky;
    top: ${({ theme }) => theme.variables.titleBarHeight + theme.variables.tabBarHeight}px;
    height: 2px;
    margin-bottom: -2px;
    flex-shrink: 0;
    z-index: 35;
    pointer-events: none;
    overflow: hidden;

    &::after {
      content: "";
      position: absolute;
      top: 0;
      left: 0;
      width: 100%;
      height: 2px;
      background: ${({ theme }) => theme.colors.editor.accent};
      transform-origin: left;
      opacity: 0;
    }

    &[data-navigation="loading"]::after {
      width: 32%;
      opacity: 0.8;
      animation: monolog-route-scan 1100ms ease-in-out infinite;
    }

    &[data-navigation="complete"]::after {
      animation: monolog-route-finish 420ms var(--motion-ease);
    }
  }


  .filetree-backdrop {
    display: none;
  }

  @media (max-width: ${({ theme }) => theme.variables.breakpoint}px) {
    .filetree-backdrop {
      display: block;
      position: fixed;
      top: ${({ theme }) => theme.variables.titleBarHeight}px;
      left: ${({ theme }) => theme.variables.activityBarWidth}px;
      right: 0;
      bottom: ${({ theme }) => theme.variables.statusBarHeight}px;
      background: rgba(0, 0, 0, 0.45);
      z-index: 15;
      opacity: 0;
      pointer-events: none;
      transition: opacity var(--motion-fast);

      &.open {
        opacity: 1;
        pointer-events: auto;
        cursor: pointer;
      }
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .page-content,
    .route-signal[data-navigation]::after { animation: none; }
    .filetree-backdrop { transition: none; }
  }
`
