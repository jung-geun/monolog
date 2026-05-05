import Link from "next/link"
import { useRouter } from "next/router"
import styled from "@emotion/styled"
import { useRouteChrome } from "./RouteChromeContext"

const TabBar = () => {
  const router = useRouter()
  const { tabs, activeTabId, closeTab, switchTab } = useRouteChrome()

  const handleClose = (e: React.MouseEvent, id: string) => {
    e.preventDefault()
    e.stopPropagation()
    closeTab(id)
  }

  return (
    <StyledWrapper>
      {tabs.map((tab) => {
        const isActive = tab.id === activeTabId
        return (
          <Link
            key={tab.id}
            href={tab.href}
            className={`tab${isActive ? " active" : ""}`}
            aria-current={isActive ? "page" : undefined}
            onClick={() => switchTab(tab.id)}
          >
            <span className="icon">◧</span>
            <span className="label">{tab.label}</span>
            {tab.closeable && (
              <button
                className="close-btn"
                aria-label={`${tab.label} 닫기`}
                onClick={(e) => handleClose(e, tab.id)}
              >
                ×
              </button>
            )}
          </Link>
        )
      })}
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
  overflow-x: auto;
  overflow-y: hidden;
  scrollbar-width: none;
  &::-webkit-scrollbar { display: none; }

  .tab {
    position: relative;
    padding: 0 10px 0 12px;
    display: flex;
    align-items: center;
    gap: 6px;
    border-right: 1px solid ${({ theme }) => theme.colors.editor.line};
    color: ${({ theme }) => theme.colors.editor.fg3};
    background: transparent;
    white-space: nowrap;
    cursor: pointer;
    text-decoration: none;
    flex-shrink: 0;
    max-width: 220px;

    &.active {
      background: ${({ theme }) => theme.colors.editor.bg};
      color: ${({ theme }) => theme.colors.editor.fg};

      &::before {
        content: "";
        position: absolute;
        top: 0;
        left: 0;
        right: 0;
        height: 1px;
        background: ${({ theme }) => theme.colors.editor.accent};
      }
    }

    .icon {
      color: ${({ theme }) => theme.colors.editor.accent2};
      flex-shrink: 0;
    }

    .label {
      overflow: hidden;
      text-overflow: ellipsis;
      flex: 1;
      min-width: 0;
    }

    .close-btn {
      all: unset;
      width: 14px;
      height: 14px;
      display: grid;
      place-items: center;
      border-radius: 3px;
      opacity: 0;
      font-size: 13px;
      line-height: 1;
      color: ${({ theme }) => theme.colors.editor.fg3};
      cursor: pointer;
      flex-shrink: 0;
      transition: opacity 0.1s, background 0.1s;

      &:hover {
        background: rgba(255, 255, 255, 0.1);
        color: ${({ theme }) => theme.colors.editor.fg};
      }
    }

    &:hover .close-btn {
      opacity: 1;
    }
    &.active .close-btn {
      opacity: 0.7;
    }
  }

  .filler {
    flex: 1;
    border-bottom: 1px solid ${({ theme }) => theme.colors.editor.line};
    min-width: 0;
  }
`
