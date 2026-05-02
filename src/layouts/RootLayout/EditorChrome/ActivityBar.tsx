import { useRouter } from "next/router"
import Link from "next/link"
import styled from "@emotion/styled"
import useScheme from "src/hooks/useScheme"

const ICONS = [
  { icon: "▤", label: "explorer", href: "/" },
  { icon: "⌕", label: "search", href: "/search" },
  { icon: "✦", label: "graph", href: "/graph" },
  { icon: "⌘", label: "commands", href: null },
  { icon: "✎", label: "drafts", href: null, disabled: true },
]

type Props = {
  activeActivity?: string
}

const ActivityBar = ({ activeActivity }: Props) => {
  const router = useRouter()
  const [scheme, setScheme] = useScheme()

  const current = activeActivity || (() => {
    if (router.pathname === "/") return "explorer"
    if (router.pathname === "/search") return "search"
    if (router.pathname === "/graph") return "graph"
    return "explorer"
  })()

  const handleCommandsClick = () => {
    window.dispatchEvent(new CustomEvent("open-command-palette"))
  }

  return (
    <StyledWrapper>
      {ICONS.map(({ icon, label, href, disabled }) => {
        const isActive = current === label
        if (href) {
          return (
            <Link
              key={label}
              href={href}
              className={`icon-btn${isActive ? " active" : ""}${disabled ? " disabled" : ""}`}
              title={label}
              aria-label={label}
            >
              {icon}
            </Link>
          )
        }
        return (
          <button
            key={label}
            className={`icon-btn${isActive ? " active" : ""}${disabled ? " disabled" : ""}`}
            title={label}
            aria-label={label}
            onClick={label === "commands" ? handleCommandsClick : undefined}
          >
            {icon}
          </button>
        )
      })}

      <div className="spacer" />

      <button
        className="icon-btn theme-toggle"
        title="Toggle theme"
        aria-label="Toggle theme"
        onClick={() => setScheme(scheme === "light" ? "dark" : "light")}
      >
        {scheme === "light" ? "☀" : "☾"}
      </button>

      <button className="icon-btn disabled" title="settings" aria-label="settings">
        ⚙
      </button>
    </StyledWrapper>
  )
}

export default ActivityBar

const StyledWrapper = styled.aside`
  position: relative;
  height: 100%;
  flex-shrink: 0;
  width: ${({ theme }) => theme.variables.activityBarWidth}px;
  background: ${({ theme }) => theme.colors.editor.bg2};
  border-right: 1px solid ${({ theme }) => theme.colors.editor.line};
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 12px 0;
  gap: 8px;
  z-index: 5;

  .spacer { flex: 1; }

  .icon-btn {
    width: 32px;
    height: 32px;
    display: flex;
    align-items: center;
    justify-content: center;
    color: ${({ theme }) => theme.colors.editor.fg3};
    border-left: 2px solid transparent;
    font-size: 16px;
    font-family: var(--font-mono, monospace);
    cursor: pointer;
    text-decoration: none;
    background: transparent;
    border-top: none;
    border-right: none;
    border-bottom: none;
    padding: 0;
    transition: color 0.15s;

    &:hover:not(.disabled) {
      color: ${({ theme }) => theme.colors.editor.fg};
    }

    &.active {
      color: ${({ theme }) => theme.colors.editor.fg};
      border-left-color: ${({ theme }) => theme.colors.editor.accent};
    }

    &.disabled {
      opacity: 0.35;
      cursor: default;
    }

    &.theme-toggle {
      font-size: 14px;
    }
  }

  @media (max-width: ${({ theme }) => theme.variables.breakpoint}px) {
    display: none;
  }
`
