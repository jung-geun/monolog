import Link from "next/link"
import styled from "@emotion/styled"
import { useRouteChrome } from "./RouteChromeContext"

const TabBar = () => {
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
  position: sticky;
  top: ${({ theme }) => theme.variables.titleBarHeight}px;
  z-index: 30;
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
    animation: monolog-tab-enter 220ms var(--motion-ease);
    transition: color var(--motion-fast), background var(--motion-fast);

    &::before {
      content: "";
      position: absolute;
      top: 0;
      left: 0;
      right: 0;
      height: 1px;
      background: ${({ theme }) => theme.colors.editor.accent};
      transform: scaleX(0);
      transform-origin: left;
      transition: transform 220ms var(--motion-ease);
    }

    &:hover:not(.active) {
      background: ${({ theme }) => theme.colors.editor.bg3};
      color: ${({ theme }) => theme.colors.editor.fg};
    }

    &:focus-visible {
      outline: 1px solid ${({ theme }) => theme.colors.editor.accent};
      outline-offset: -3px;
    }

    &:active .icon { transform: scale(0.85); }

    &.active {
      background: ${({ theme }) => theme.colors.editor.bg};
      color: ${({ theme }) => theme.colors.editor.fg};

      &::before { transform: scaleX(1); }
    }

    .icon {
      color: ${({ theme }) => theme.colors.editor.accent2};
      flex-shrink: 0;
      transition: transform var(--motion-fast) var(--motion-ease);
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
      transition: opacity var(--motion-fast), background var(--motion-fast), transform var(--motion-fast);

      &:hover {
        background: rgba(255, 255, 255, 0.1);
        color: ${({ theme }) => theme.colors.editor.fg};
      }

      &:active { transform: scale(0.85); }
      &:focus-visible {
        opacity: 1;
        outline: 1px solid ${({ theme }) => theme.colors.editor.accent};
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

  @media (prefers-reduced-motion: reduce) {
    .tab { animation: none; }
    .tab::before { transition: none; }
    .tab:active .icon,
    .tab .close-btn:active { transform: none; }
  }
`
