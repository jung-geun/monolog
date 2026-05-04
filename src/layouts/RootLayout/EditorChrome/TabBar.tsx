import Link from "next/link"
import { useRouter } from "next/router"
import styled from "@emotion/styled"
import { useRouteChrome } from "./RouteChromeContext"

const README_LABEL = "README.md"

const TabBar = () => {
  const router = useRouter()
  const { chrome } = useRouteChrome()
  const isHome = router.pathname === "/"
  const previewLabel = !isHome ? chrome.filename : null
  const previewHref = !isHome ? router.asPath : null

  return (
    <StyledWrapper>
      <Link
        href="/"
        className={`tab pinned${isHome ? " active" : ""}`}
        aria-current={isHome ? "page" : undefined}
      >
        <span className="icon">◧</span>
        <span className="label">{README_LABEL}</span>
      </Link>
      {previewLabel && previewHref && (
        <Link
          href={previewHref}
          className="tab preview active"
          aria-current="page"
        >
          <span className="icon">◧</span>
          <span className="label">{previewLabel}</span>
          <span className="close" aria-hidden="true">×</span>
        </Link>
      )}
      <div className="filler" />
    </StyledWrapper>
  )
}

export default TabBar

const StyledWrapper = styled.div`
  height: ${({ theme }) => theme.variables.tabBarHeight}px;
  background: ${({ theme }) => theme.colors.editor.bg2};
  border-bottom: 1px solid ${({ theme }) => theme.colors.editor.line};
  display: flex;
  font-family: var(--font-mono, monospace);
  font-size: 12px;
  flex-shrink: 0;
  overflow: hidden;

  .tab {
    position: relative;
    padding: 0 14px;
    display: flex;
    align-items: center;
    gap: 8px;
    border-right: 1px solid ${({ theme }) => theme.colors.editor.line};
    color: ${({ theme }) => theme.colors.editor.fg3};
    background: transparent;
    white-space: nowrap;
    cursor: pointer;
    text-decoration: none;

    &.preview .label {
      font-style: italic;
    }

    &.active {
      background: ${({ theme }) => theme.colors.editor.bg};
      color: ${({ theme }) => theme.colors.editor.fg};

      &::after {
        content: "";
        position: absolute;
        left: 0;
        right: 0;
        bottom: -1px;
        height: 2px;
        background: ${({ theme }) => theme.colors.editor.accent};
      }
    }

    .icon {
      color: ${({ theme }) => theme.colors.editor.accent2};
    }
    .close {
      color: ${({ theme }) => theme.colors.editor.fg4};
    }
  }

  .filler {
    flex: 1;
    border-bottom: 1px solid ${({ theme }) => theme.colors.editor.line};
  }
`
