import { useEffect, useRef, useState, useMemo, type ReactNode } from "react"
import { useRouter } from "next/router"
import styled, { CSSObject } from "@emotion/styled"
import { keyframes } from "@emotion/react"
import useCommandPalette from "src/hooks/useCommandPalette"
import usePostsQuery from "src/hooks/usePostsQuery"
import { useCategoriesQuery } from "src/hooks/useCategoriesQuery"
import { useTagsQuery } from "src/hooks/useTagsQuery"
import useScheme from "src/hooks/useScheme"
import { DEFAULT_CATEGORY } from "src/constants"
import {
  SunIcon,
  SearchIcon,
  GraphIcon,
  ExplorerIcon,
} from "src/layouts/RootLayout/EditorChrome/ActivityIcons"

type CommandKind = "action" | "post" | "tag" | "cat"

type Command = {
  kind: CommandKind
  label: string
  sub?: string
  hint?: string
  icon: ReactNode
  href?: string
  action?: () => void
}

const GROUP_LABELS: Record<CommandKind, string> = {
  action: "Actions",
  post: "Posts",
  tag: "Tags",
  cat: "Categories",
}

const CommandPalette = () => {
  const { open, closePalette } = useCommandPalette()
  const router = useRouter()
  const posts = usePostsQuery()
  const categories = useCategoriesQuery()
  const tags = useTagsQuery()
  const [scheme, setScheme] = useScheme()
  const [q, setQ] = useState("")
  const [sel, setSel] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (open) {
      setQ("")
      setSel(0)
      setTimeout(() => inputRef.current?.focus(), 50)
    }
  }, [open])

  const allCommands = useMemo((): Command[] => [
    {
      kind: "action",
      label: "Toggle theme",
      hint: "⌘⇧L",
      icon: <SunIcon size={14} />,
      action: () => setScheme(scheme === "light" ? "dark" : "light"),
    },
    { kind: "action", label: "Go home", hint: "g h", icon: "→", href: "/" },
    { kind: "action", label: "Open about", hint: "g a", icon: "→", href: "/about" },
    { kind: "action", label: "Knowledge graph", hint: "g g", icon: <GraphIcon size={14} />, href: "/graph" },
    { kind: "action", label: "Search posts", hint: "/", icon: <SearchIcon size={14} />, href: "/search" },
    ...posts.map((p): Command => ({
      kind: "post",
      label: p.title,
      sub: `${p.slug}.md`,
      hint: (p.date?.start_date || "").slice(2).replace(/-/g, "."),
      icon: "◧",
      href: `/${p.slug}`,
    })),
    ...Object.keys(tags)
      .slice(0, 10)
      .map((t): Command => ({
        kind: "tag",
        label: `#${t}`,
        sub: `filter posts by tag`,
        icon: "#",
        href: `/search?q=${encodeURIComponent(t)}`,
      })),
    ...Object.keys(categories)
      .filter((c) => c !== DEFAULT_CATEGORY)
      .map((c): Command => ({
        kind: "cat",
        label: c,
        sub: `${categories[c]} posts`,
        icon: <ExplorerIcon size={14} />,
        href: `/categories/${c}`,
      })),
  ], [posts, categories, tags, scheme, setScheme])

  const filtered = useMemo(() => {
    if (!q) return allCommands.slice(0, 9)
    const lq = q.toLowerCase()
    return allCommands
      .filter(
        (c) =>
          c.label.toLowerCase().includes(lq) ||
          (c.sub || "").toLowerCase().includes(lq)
      )
      .slice(0, 9)
  }, [q, allCommands])

  useEffect(() => setSel(0), [q])

  const handleKey = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") {
      e.preventDefault()
      setSel((s) => Math.min(s + 1, filtered.length - 1))
    } else if (e.key === "ArrowUp") {
      e.preventDefault()
      setSel((s) => Math.max(s - 1, 0))
    } else if (e.key === "Enter") {
      e.preventDefault()
      const cmd = filtered[sel]
      if (cmd) execute(cmd)
    }
  }

  const execute = (cmd: Command) => {
    closePalette()
    if (cmd.action) {
      cmd.action()
    } else if (cmd.href) {
      router.push(cmd.href)
    }
  }

  if (!open) return null

  // Group filtered commands
  const grouped: Partial<Record<CommandKind, (Command & { _idx: number })[]>> = {}
  filtered.forEach((c, i) => {
    const kind = c.kind
    if (!grouped[kind]) grouped[kind] = []
    grouped[kind]!.push({ ...c, _idx: i })
  })

  return (
    <StyledOverlay onClick={(e) => e.target === e.currentTarget && closePalette()}>
      <StyledPanel>
        <div className="search-row">
          <span className="prompt">›</span>
          <input
            ref={inputRef}
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={handleKey}
            placeholder="Type a command, post title, tag, or category…"
          />
          <kbd>⌘K</kbd>
        </div>

        <div className="results">
          {(Object.keys(grouped) as CommandKind[]).map((kind) => (
            <div key={kind} className="group">
              <div className="group-label">{GROUP_LABELS[kind]}</div>
              {grouped[kind]!.map((cmd) => {
                const isActive = cmd._idx === sel
                return (
                  <div
                    key={cmd._idx}
                    className={`cmd-row${isActive ? " active" : ""}`}
                    onMouseEnter={() => setSel(cmd._idx)}
                    onClick={() => execute(cmd)}
                  >
                    <span className="cmd-icon">{cmd.icon}</span>
                    <div className="cmd-info">
                      <div className="cmd-label">{cmd.label}</div>
                      {cmd.sub && <div className="cmd-sub">{cmd.sub}</div>}
                    </div>
                    {cmd.hint && <kbd className="cmd-hint">{cmd.hint}</kbd>}
                  </div>
                )
              })}
            </div>
          ))}

          {filtered.length === 0 && (
            <div className="no-results">
              <span className="fatal">fatal:</span> no matches for &quot;{q}&quot;
            </div>
          )}
        </div>

        <div className="footer">
          <span><kbd>↑↓</kbd> navigate</span>
          <span><kbd>↵</kbd> select</span>
          <span><kbd>esc</kbd> close</span>
          <span className="help">type <span className="accent">?</span> for help</span>
        </div>
      </StyledPanel>
    </StyledOverlay>
  )
}

export default CommandPalette

const StyledOverlay = styled.div`
  position: fixed;
  inset: 0;
  background: rgba(15, 12, 8, 0.4);
  backdrop-filter: blur(2px);
  z-index: 1000;
  display: flex;
  justify-content: center;
  padding-top: 60px;
  align-items: flex-start;
`

const StyledPanel = styled.div`
  width: 620px;
  max-width: 92vw;
  background: ${({ theme }) => theme.colors.editor.bg};
  border: 1px solid ${({ theme }) => theme.colors.editor.line2};
  box-shadow: 0 24px 60px rgba(0, 0, 0, 0.25);
  border-radius: 6px;
  overflow: hidden;
  font-family: var(--font-mono, monospace);

  .search-row {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 16px 18px;
    border-bottom: 1px solid ${({ theme }) => theme.colors.editor.line};

    .prompt {
      color: ${({ theme }) => theme.colors.editor.accent};
      font-size: 16px;
    }

    input {
      flex: 1;
      border: none;
      outline: none;
      background: transparent;
      font-family: var(--font-mono, monospace);
      font-size: 16px;
      color: ${({ theme }) => theme.colors.editor.fg};

      &::placeholder { color: ${({ theme }) => theme.colors.editor.fg3}; }
    }

    kbd {
      font-family: var(--font-mono, monospace);
      font-size: 11px;
      padding: 2px 8px;
      background: ${({ theme }) => theme.colors.editor.bg2};
      border: 1px solid ${({ theme }) => theme.colors.editor.line2};
      border-radius: 3px;
      color: ${({ theme }) => theme.colors.editor.fg3};
    }
  }

  .results {
    max-height: 420px;
    overflow-y: auto;
    padding: 6px 0;
    scrollbar-width: none;
    &::-webkit-scrollbar { display: none; }
  }

  .group-label {
    padding: 8px 18px 4px;
    font-size: 10px;
    color: ${({ theme }) => theme.colors.editor.fg3};
    text-transform: uppercase;
    letter-spacing: 1.5px;
  }

  .cmd-row {
    display: grid;
    grid-template-columns: 28px 1fr auto;
    gap: 12px;
    align-items: center;
    padding: 8px 18px;
    cursor: pointer;
    border-left: 2px solid transparent;

    &.active {
      background: ${({ theme }) => theme.colors.editor.accentSoft};
      border-left-color: ${({ theme }) => theme.colors.editor.accent};

      .cmd-icon { color: ${({ theme }) => theme.colors.editor.accent}; }
    }

    .cmd-icon {
      font-size: 14px;
      color: ${({ theme }) => theme.colors.editor.fg3};
    }

    .cmd-info {
      min-width: 0;

      .cmd-label {
        font-size: 13px;
        color: ${({ theme }) => theme.colors.editor.fg};
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
      }
      .cmd-sub {
        font-size: 11px;
        color: ${({ theme }) => theme.colors.editor.fg3};
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
      }
    }

    .cmd-hint {
      font-family: var(--font-mono, monospace);
      font-size: 10px;
      padding: 1px 6px;
      background: ${({ theme }) => theme.colors.editor.bg2};
      border: 1px solid ${({ theme }) => theme.colors.editor.line2};
      border-radius: 3px;
      color: ${({ theme }) => theme.colors.editor.fg3};
      white-space: nowrap;
    }
  }

  .no-results {
    padding: 24px 18px;
    font-size: 13px;
    color: ${({ theme }) => theme.colors.editor.fg3};
    text-align: center;

    .fatal { color: ${({ theme }) => theme.colors.editor.accent2}; }
  }

  .footer {
    display: flex;
    gap: 18px;
    padding: 8px 18px;
    border-top: 1px solid ${({ theme }) => theme.colors.editor.line};
    background: ${({ theme }) => theme.colors.editor.bg2};
    font-size: 10.5px;
    color: ${({ theme }) => theme.colors.editor.fg3};
    flex-wrap: wrap;

    kbd {
      padding: 0 4px;
      border: 1px solid ${({ theme }) => theme.colors.editor.line2};
      background: ${({ theme }) => theme.colors.editor.bg};
      border-radius: 2px;
    }

    .help {
      margin-left: auto;
      .accent { color: ${({ theme }) => theme.colors.editor.accent}; }
    }
  }
`
