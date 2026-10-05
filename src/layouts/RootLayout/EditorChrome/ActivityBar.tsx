import { useRouter } from "next/compat/router"
import Link from "next/link"
import styled from "@emotion/styled"
import useScheme from "src/hooks/useScheme"
import { useRouteChrome } from "./RouteChromeContext"
import {
  ExplorerIcon,
  SearchIcon,
  GraphIcon,
  CommandIcon,
  DraftsIcon,
  SunIcon,
  MoonIcon,
  SettingsIcon,
} from "./ActivityIcons"

const ActivityBar = () => {
  const router = useRouter()
  const pathname = router?.pathname
  const [scheme, setScheme] = useScheme()
  const { isFileTreeOpen, toggleFileTree } = useRouteChrome()

  const handleCommandsClick = () => {
    window.dispatchEvent(new CustomEvent("open-command-palette"))
  }

  return (
    <StyledWrapper>
      <button
        className={`icon-btn${isFileTreeOpen ? " active" : ""}`}
        title="explorer"
        aria-label="explorer"
        aria-pressed={isFileTreeOpen}
        onClick={toggleFileTree}
      >
        <ExplorerIcon />
      </button>

      <Link
        href="/search"
        className={`icon-btn${!isFileTreeOpen && pathname === "/search" ? " active" : ""}`}
        title="search"
        aria-label="search"
      >
        <SearchIcon />
      </Link>

      <Link
        href="/graph"
        className={`icon-btn${!isFileTreeOpen && pathname === "/graph" ? " active" : ""}`}
        title="graph"
        aria-label="graph"
      >
        <GraphIcon />
      </Link>

      <button
        className="icon-btn"
        title="commands"
        aria-label="commands"
        onClick={handleCommandsClick}
      >
        <CommandIcon />
      </button>

      <button className="icon-btn disabled" title="drafts" aria-label="drafts">
        <DraftsIcon />
      </button>

      <div className="spacer" />

      <button
        className="icon-btn theme-toggle"
        title="Toggle theme"
        aria-label="Toggle theme"
        onClick={() => setScheme(scheme === "light" ? "dark" : "light")}
      >
        <span className="theme-icon" key={scheme} aria-hidden="true">
          {scheme === "light" ? <SunIcon /> : <MoonIcon />}
        </span>
      </button>

      <button className="icon-btn disabled" title="settings" aria-label="settings">
        <SettingsIcon />
      </button>
    </StyledWrapper>
  )
}

export default ActivityBar

const StyledWrapper = styled.aside`
  position: sticky;
  top: ${({ theme }) => theme.variables.titleBarHeight}px;
  height: calc(100vh - ${({ theme }) => theme.variables.titleBarHeight + theme.variables.statusBarHeight}px);
  height: calc(100dvh - ${({ theme }) => theme.variables.titleBarHeight + theme.variables.statusBarHeight}px);
  align-self: flex-start;
  width: ${({ theme }) => theme.variables.activityBarWidth}px;
  background: ${({ theme }) => theme.colors.editor.bg2};
  border-right: 1px solid ${({ theme }) => theme.colors.editor.line};
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 12px 0;
  z-index: 30;

  > * + * { margin-top: 8px; }
  .spacer { flex: 1; }

  .icon-btn {
    width: 32px;
    height: 32px;
    display: flex;
    align-items: center;
    justify-content: center;
    color: ${({ theme }) => theme.colors.editor.fg3};
    border-left: 2px solid transparent;
    cursor: pointer;
    text-decoration: none;
    background: transparent;
    border-top: none;
    border-right: none;
    border-bottom: none;
    padding: 0;
    transition: color var(--motion-fast), background var(--motion-fast);

    svg {
      display: block;
      transition: transform var(--motion-fast) var(--motion-ease);
    }

    .theme-icon { animation: monolog-icon-turn 280ms var(--motion-ease); }

    &:hover:not(.disabled) {
      color: ${({ theme }) => theme.colors.editor.fg};
      background: ${({ theme }) => theme.colors.editor.bg3};
      svg { transform: translateY(-1px) scale(1.08); }
    }

    &:active:not(.disabled) svg { transform: scale(0.9); }

    &:focus-visible {
      outline: 1px solid ${({ theme }) => theme.colors.editor.accent};
      outline-offset: 2px;
    }

    &.active {
      color: ${({ theme }) => theme.colors.editor.fg};
      border-left-color: ${({ theme }) => theme.colors.editor.accent};
    }

    &.disabled {
      opacity: 0.35;
      cursor: default;
    }
  }

  @media (max-width: ${({ theme }) => theme.variables.breakpoint}px) {
    padding: 8px 0;
    > * + * { margin-top: 4px; }
  }

  @media (prefers-reduced-motion: reduce) {
    .icon-btn .theme-icon { animation: none; }
    .icon-btn:hover:not(.disabled) svg,
    .icon-btn:active:not(.disabled) svg { transform: none; }
  }
`
