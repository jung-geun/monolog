import { forwardRef } from "react"
import Link from "next/link"
import styled from "@emotion/styled"
import { useRouteChrome } from "./RouteChromeContext"

type Props = {
  preferencesOpen: boolean
  onTogglePreferences: () => void
}

const TabBar = forwardRef<HTMLButtonElement, Props>(function TabBar(
  { preferencesOpen, onTogglePreferences },
  preferencesButtonRef
) {
  const {
    tabs, activeTabId, closeTab, switchTab,
    reopenLastPost, canReopenPost, tabStorageConsent,
  } = useRouteChrome()

  const handleClose = (e: React.MouseEvent, id: string) => {
    e.preventDefault()
    e.stopPropagation()
    closeTab(id)
  }

  return (
    <StyledWrapper>
      <div className="tab-list">
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
                type="button"
                title={tab.kind === "post" ? "글 닫기 · Alt/Option+W (입력 중 제외)" : "탭 닫기"}
                onClick={(e) => handleClose(e, tab.id)}
              >
                ×
              </button>
            )}
          </Link>
        )
      })}
      </div>
      <div className="tab-tools">
        <button
          type="button"
          onClick={reopenLastPost}
          disabled={!canReopenPost}
          aria-label="마지막으로 닫은 글 다시 열기"
          title="마지막으로 닫은 글 다시 열기 · Alt/Option+Shift+T (입력 중 제외)"
        >
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
            <path d="M3 5.5A5 5 0 1 1 3 11M3 2v3.5h3.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
        <button
          ref={preferencesButtonRef}
          type="button"
          className={tabStorageConsent === "unavailable" ? "storage-unavailable" : undefined}
          onClick={onTogglePreferences}
          aria-label="탭 저장 설정"
          aria-expanded={preferencesOpen}
          aria-controls="editor-tab-session-controls"
          title={`탭 저장 설정 · ${tabStorageConsent === "enabled" ? "이 브라우저에 저장 중" : tabStorageConsent === "unavailable" ? "저장소 접근 불가 · 이번 방문만 유지" : "이번 방문만 유지"}`}
        >
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
            <path d="M2 4h12M2 8h12M2 12h12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
            <path d="M5 2.5v3M11 6.5v3M6 10.5v3" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
          </svg>
          {tabStorageConsent === "unavailable" && <span className="storage-warning" aria-hidden="true">저장 불가</span>}
        </button>
      </div>
    </StyledWrapper>
  )
})

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
  min-width: 0;

  .tab-list {
    display: flex;
    flex: 1;
    min-width: 0;
    overflow-x: auto;
    overflow-y: hidden;
    scrollbar-width: none;
    &::-webkit-scrollbar { display: none; }
  }

  .tab-tools {
    display: flex;
    flex-shrink: 0;
    border-left: 1px solid ${({ theme }) => theme.colors.editor.line};
    background: ${({ theme }) => theme.colors.editor.bg2};

    button {
      display: grid;
      place-items: center;
      width: 36px;
      min-height: 32px;
      padding: 0;
      border: 0;
      background: transparent;
      color: ${({ theme }) => theme.colors.editor.fg2};
      cursor: pointer;

      &:hover:not(:disabled), &[aria-expanded="true"] {
        background: ${({ theme }) => theme.colors.editor.bg3};
        color: ${({ theme }) => theme.colors.editor.fg};
      }
      &:focus-visible {
        outline: 1px solid ${({ theme }) => theme.colors.editor.accent};
        outline-offset: -3px;
      }
      &:disabled { opacity: 0.4; cursor: default; }
    }
    .storage-unavailable {
      width: auto;
      padding: 0 8px;
      display: flex;
      gap: 5px;
    }
    .storage-warning { font-size: 10px; white-space: nowrap; }
  }

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
      width: 24px;
      height: 28px;
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

  @media (pointer: coarse) {
    .tab .close-btn { opacity: 0.7; }
  }

  @media (prefers-reduced-motion: reduce) {
    .tab { animation: none; }
    .tab::before { transition: none; }
    .tab:active .icon,
    .tab .close-btn:active { transform: none; }
  }
`
