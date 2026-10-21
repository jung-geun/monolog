import { useEffect, useRef, useState } from "react"
import Link from "next/link"
import styled from "@emotion/styled"
import { useRouteChrome } from "./RouteChromeContext"
import WorkbenchIcon from "src/components/WorkbenchIcon"
import TabIcon from "./TabIcon"

const TabBar = () => {
  const {
    tabs, activeTabId, closeTab, switchTab, moveTab, pinTab,
    reopenLastPost, canReopenPost,
  } = useRouteChrome()
  const draggedTabId = useRef<string | null>(null)
  const canDrag = useRef(true)
  const [draggingTabId, setDraggingTabId] = useState<string | null>(null)
  const [dropBeforeId, setDropBeforeId] = useState<string | null>()
  const [moveAnnouncement, setMoveAnnouncement] = useState("")
  const activeTabIndex = tabs.findIndex((tab) => tab.id === activeTabId)
  const [menu, setMenu] = useState<{ id: string; x: number; y: number } | null>(null)
  const menuRef = useRef<HTMLDivElement>(null)
  const actionsButtonRef = useRef<HTMLButtonElement>(null)
  const menuTab = tabs.find((tab) => tab.id === menu?.id)
  useEffect(() => {
    if (!menu) return
    menuRef.current?.querySelector<HTMLButtonElement>("button:not(:disabled)")?.focus()
    const dismiss = (event: PointerEvent) => {
      if (event.target instanceof Element && event.target.closest('[aria-haspopup="menu"]')) return
      if (!(event.target instanceof Node) || !menuRef.current?.contains(event.target)) setMenu(null)
    }
    window.addEventListener("pointerdown", dismiss)
    return () => window.removeEventListener("pointerdown", dismiss)
  }, [menu])

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
    event.dataTransfer.setData("application/x-tablog-tab", id)
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
            onDoubleClick={() => pinTab(tab.id)}
            onContextMenu={(event) => {
              event.preventDefault()
              setMenu({ id: tab.id, x: Math.min(event.clientX, window.innerWidth - 224), y: Math.min(event.clientY, window.innerHeight - 250) })
            }}
            onKeyDown={(event) => {
              if (event.shiftKey && event.key === "F10") {
                event.preventDefault()
                const bounds = event.currentTarget.getBoundingClientRect()
                setMenu({ id: tab.id, x: Math.min(bounds.left, window.innerWidth - 224), y: bounds.bottom })
              }
            }}
          >
            <Link href={tab.href} className="tab-link" draggable={false} aria-current={isActive ? "page" : undefined} onNavigate={() => switchTab(tab.id)}>
              <TabIcon tab={tab} />
              <span className={`label${tab.preview ? " preview" : ""}`}>{tab.label}</span>
            </Link>
            {tab.closeable && (
              <button
                className="close-btn"
                aria-label={`${tab.label} 닫기`}
                type="button"
                title={tab.kind === "post" ? "글 닫기 · Alt/Option+W (입력 중 제외)" : "탭 닫기"}
                onClick={() => closeTab(tab.id)}
              >
                <WorkbenchIcon name="close" size={14} />
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
          disabled={activeTabIndex <= 0}
          aria-label="현재 탭 왼쪽으로 이동"
          title="현재 탭 왼쪽으로 이동"
        >
          <WorkbenchIcon name="arrow-left" />
        </button>
        <button
          type="button"
          onClick={() => moveActiveTab(1)}
          disabled={activeTabIndex < 0 || activeTabIndex === tabs.length - 1}
          aria-label="현재 탭 오른쪽으로 이동"
          title="현재 탭 오른쪽으로 이동"
        >
          <WorkbenchIcon name="arrow-right" />
        </button>
        <button
          type="button"
          onClick={reopenLastPost}
          disabled={!canReopenPost}
          aria-label="마지막으로 닫은 글 다시 열기"
          title="마지막으로 닫은 글 다시 열기 · Alt/Option+Shift+T (입력 중 제외)"
        >
          <WorkbenchIcon name="history" />
        </button>
        <button ref={actionsButtonRef} type="button" aria-label="Editor actions" title="Editor actions" aria-haspopup="menu" aria-controls="editor-tab-actions" aria-expanded={menu?.id === activeTabId} onClick={(event) => {
          if (menu) { setMenu(null); return }
          const bounds = event.currentTarget.getBoundingClientRect()
          setMenu({ id: activeTabId, x: Math.min(bounds.left, window.innerWidth - 224), y: Math.min(bounds.bottom, window.innerHeight - 250) })
        }}><WorkbenchIcon name="more" /></button>
      </div>
      <span className="move-status" role="status" aria-live="polite">{moveAnnouncement}</span>
      {menu && menuTab && <div id="editor-tab-actions" ref={menuRef} role="menu" aria-label={`${menuTab.label} tab actions`} className="context-menu" style={{ left: Math.max(4, menu.x), top: Math.max(4, menu.y) }} onClick={() => { setMenu(null); actionsButtonRef.current?.focus() }} onKeyDown={(event) => {
        const buttons = Array.from(event.currentTarget.querySelectorAll<HTMLButtonElement>("button:not(:disabled)"))
        const index = buttons.indexOf(document.activeElement as HTMLButtonElement)
        if (event.key === "Escape" || event.key === "Tab") {
          setMenu(null)
          if (event.key === "Escape") { event.preventDefault(); document.querySelector<HTMLAnchorElement>(`[data-tab-id="${CSS.escape(menu.id)}"] .tab-link`)?.focus() }
        } else if (event.key === "ArrowDown" || event.key === "ArrowUp") {
          event.preventDefault()
          buttons[(index + (event.key === "ArrowDown" ? 1 : buttons.length - 1)) % buttons.length]?.focus()
        }
      }}>
        {menuTab.preview && <button type="button" role="menuitem" onClick={() => pinTab(menuTab.id)}><WorkbenchIcon name="pin" />Keep open</button>}
        <button type="button" role="menuitem" disabled={!menuTab.closeable} onClick={() => closeTab(menuTab.id)}><WorkbenchIcon name="close" />Close editor</button>
        <button type="button" role="menuitem" disabled={!canReopenPost} onClick={reopenLastPost}><WorkbenchIcon name="history" />Reopen closed post</button>
        <button type="button" role="menuitem" disabled={tabs[0].id === menuTab.id} onClick={() => moveTab(menuTab.id, tabs[0].id)}><WorkbenchIcon name="arrow-left" />Move to first</button>
        <button type="button" role="menuitem" disabled={tabs[tabs.length - 1].id === menuTab.id} onClick={() => moveTab(menuTab.id, null)}><WorkbenchIcon name="arrow-right" />Move to last</button>
        <button type="button" role="menuitem" onClick={async () => {
          try {
            await navigator.clipboard.writeText(new URL(menuTab.href, window.location.origin).href)
            setMoveAnnouncement("Editor link copied")
          } catch {
            setMoveAnnouncement("Could not copy the editor link")
          }
        }}><WorkbenchIcon name="link" />Copy link</button>
      </div>}
    </StyledWrapper>
  )
}

export default TabBar

const StyledWrapper = styled.div`
  height: ${({ theme }) => theme.variables.tabBarHeight}px;
  background: ${({ theme }) => theme.colors.editor.bg2};
  border-bottom: 1px solid ${({ theme }) => theme.colors.editor.line};
  position: relative;
  z-index: 30;
  display: flex;
  font-family: var(--font-ui, sans-serif);
  font-size: 12px;
  flex-shrink: 0;
  min-width: 0;

  .preview { font-style: italic; }
  .context-menu { position: fixed; z-index: 90; width: 220px; padding: 5px; background: ${({ theme }) => theme.colors.editor.bg2}; border: 1px solid ${({ theme }) => theme.colors.editor.line}; border-radius: 5px; box-shadow: 0 6px 20px #0004; }
  .context-menu button { display: flex; gap: 8px; align-items: center; width: 100%; min-height: 32px; padding: 4px 8px; font: inherit; color: ${({ theme }) => theme.colors.editor.fg}; background: transparent; border: 0; text-align: left; cursor: pointer; }
  .context-menu button:focus-visible, .context-menu button:hover:not(:disabled) { background: ${({ theme }) => theme.colors.editor.bg3}; outline: 1px solid ${({ theme }) => theme.colors.editor.accent}; }
  .context-menu button:disabled { opacity: .4; cursor: default; }
  @media (max-width: 600px) { .tab-tools > button:first-child, .tab-tools > button:nth-child(2) { display: none; } }
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
    animation: tablog-tab-enter 220ms var(--motion-ease);
    transition: background var(--motion-fast);

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
