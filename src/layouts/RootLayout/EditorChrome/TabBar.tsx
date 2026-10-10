import { forwardRef, useRef, useState } from "react"
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
    tabs, activeTabId, closeTab, switchTab, moveTab,
    reopenLastPost, canReopenPost, tabStorageConsent,
  } = useRouteChrome()
  const draggedTabId = useRef<string | null>(null)
  const canDrag = useRef(true)
  const [draggingTabId, setDraggingTabId] = useState<string | null>(null)
  const [dropBeforeId, setDropBeforeId] = useState<string | null>()
  const [moveAnnouncement, setMoveAnnouncement] = useState("")
  const activeTabIndex = tabs.findIndex((tab) => tab.id === activeTabId)

  const moveActiveTab = (direction: -1 | 1) => {
    const target = activeTabIndex + direction
    if (activeTabIndex < 0 || target < 0 || target >= tabs.length) return
    const tab = tabs[activeTabIndex]
    moveTab(tab.id, direction < 0 ? tabs[target].id : tabs[target + 1]?.id ?? null)
    setMoveAnnouncement(`${tab.label} 탭, ${tabs.length}개 중 ${target + 1}번째 위치`)
  }

  const finishDrag = () => {
    draggedTabId.current = null
    setDraggingTabId(null)
    setDropBeforeId(undefined)
  }

  const dropPosition = (list: HTMLDivElement, clientX: number) => {
    for (const tab of list.querySelectorAll<HTMLElement>("[data-tab-id]")) {
      const bounds = tab.getBoundingClientRect()
      if (clientX < bounds.left + bounds.width / 2) return tab.dataset.tabId!
    }
    return null
  }

  const handleDragStart = (event: React.DragEvent<HTMLDivElement>, id: string) => {
    if (!canDrag.current) {
      event.preventDefault()
      return
    }
    draggedTabId.current = id
    event.dataTransfer.clearData()
    event.dataTransfer.setData("application/x-monolog-tab", id)
    event.dataTransfer.effectAllowed = "move"
    setDraggingTabId(id)
  }

  const handleDragOver = (event: React.DragEvent<HTMLDivElement>) => {
    if (draggedTabId.current === null) return
    event.preventDefault()
    event.dataTransfer.dropEffect = "move"
    setDropBeforeId(dropPosition(event.currentTarget, event.clientX))
  }

  const handleDrop = (event: React.DragEvent<HTMLDivElement>) => {
    if (draggedTabId.current === null) return
    event.preventDefault()
    moveTab(draggedTabId.current, dropPosition(event.currentTarget, event.clientX))
    finishDrag()
  }

  return (
    <StyledWrapper>
      <div
        className="tab-list"
        onDragOver={handleDragOver}
        onDrop={handleDrop}
        onDragLeave={(event) => {
          const bounds = event.currentTarget.getBoundingClientRect()
          if (event.clientX < bounds.left || event.clientX > bounds.right || event.clientY < bounds.top || event.clientY > bounds.bottom) setDropBeforeId(undefined)
        }}
      >
      {tabs.map((tab, index) => {
        const isActive = tab.id === activeTabId
        return (
          <div
            key={tab.id}
            className={`tab${isActive ? " active" : ""}${draggingTabId === tab.id ? " dragging" : ""}${dropBeforeId === tab.id ? " drop-before" : dropBeforeId === null && index === tabs.length - 1 ? " drop-after" : ""}`}
            data-tab-id={tab.id}
            draggable
            title="드래그하여 탭 순서 변경"
            onPointerDownCapture={(event) => { canDrag.current = !(event.target instanceof Element && event.target.closest("button")) }}
            onDragStart={(event) => handleDragStart(event, tab.id)}
            onDragEnd={finishDrag}
          >
            <Link href={tab.href} className="tab-link" draggable={false} aria-current={isActive ? "page" : undefined} onNavigate={() => switchTab(tab.id)}>
              <span className="icon">◧</span>
              <span className="label">{tab.label}</span>
            </Link>
            {tab.closeable && (
              <button
                className="close-btn"
                aria-label={`${tab.label} 닫기`}
                type="button"
                title={tab.kind === "post" ? "글 닫기 · Alt/Option+W (입력 중 제외)" : "탭 닫기"}
                onClick={() => closeTab(tab.id)}
              >
                ×
              </button>
            )}
          </div>
        )
      })}
      </div>
      <div className="tab-tools">
        <button
          type="button"
          onClick={() => moveActiveTab(-1)}
          aria-disabled={activeTabIndex <= 0}
          aria-label="현재 탭 왼쪽으로 이동"
          title="현재 탭 왼쪽으로 이동"
        >
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
            <path d="m10 4-4 4 4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
        <button
          type="button"
          onClick={() => moveActiveTab(1)}
          aria-disabled={activeTabIndex < 0 || activeTabIndex === tabs.length - 1}
          aria-label="현재 탭 오른쪽으로 이동"
          title="현재 탭 오른쪽으로 이동"
        >
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
            <path d="m6 4 4 4-4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
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
      <span className="move-status" role="status" aria-live="polite">{moveAnnouncement}</span>
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

  .move-status {
    position: absolute;
    width: 1px;
    height: 1px;
    overflow: hidden;
    clip-path: inset(50%);
    white-space: nowrap;
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

      &:hover:not(:disabled):not([aria-disabled="true"]), &[aria-expanded="true"] {
        background: ${({ theme }) => theme.colors.editor.bg3};
        color: ${({ theme }) => theme.colors.editor.fg};
      }
      &:focus-visible {
        outline: 1px solid ${({ theme }) => theme.colors.editor.accent};
        outline-offset: -3px;
      }
      &:disabled, &[aria-disabled="true"] { opacity: 0.4; cursor: default; }
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
    padding: 0 10px 0 0;
    display: flex;
    align-items: center;
    gap: 0;
    border-right: 1px solid ${({ theme }) => theme.colors.editor.line};
    color: ${({ theme }) => theme.colors.editor.fg3};
    background: transparent;
    white-space: nowrap;
    cursor: pointer;
    user-select: none;
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

    .tab-link {
      display: flex;
      align-items: center;
      gap: 6px;
      flex: 1;
      min-width: 0;
      height: 100%;
      padding-left: 12px;
      color: inherit;
      text-decoration: none;

      &:focus-visible {
        outline: 1px solid ${({ theme }) => theme.colors.editor.accent};
        outline-offset: -3px;
      }
    }

    &:active .icon { transform: scale(0.85); }

    &.active {
      background: ${({ theme }) => theme.colors.editor.bg};
      color: ${({ theme }) => theme.colors.editor.fg};

      &::before { transform: scaleX(1); }
    }

    &.dragging { opacity: 0.45; cursor: grabbing; }

    &.drop-before::after, &.drop-after::after {
      content: "";
      position: absolute;
      top: 4px;
      bottom: 4px;
      width: 2px;
      background: ${({ theme }) => theme.colors.editor.accent};
      pointer-events: none;
    }
    &.drop-before::after { left: 0; }
    &.drop-after::after { right: 0; }

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
      margin-left: 6px;
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
