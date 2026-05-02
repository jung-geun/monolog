import { useMemo } from "react"
import styled from "@emotion/styled"
import React from "react"
import Link from "next/link"
import TabBar from "src/layouts/RootLayout/EditorChrome/TabBar"
import { useRegisterChrome } from "src/layouts/RootLayout/EditorChrome/RouteChromeContext"

const SHORTCUTS = [
  ["⌘K", "open command palette"],
  ["g h", "go home"],
  ["g a", "open about"],
  ["/", "search posts"],
]

const TABS = [{ label: "404.md", href: "/404" }]

const CustomError: React.FC = () => {
  const statusItems = useMemo(() => ["main", "✗ ENOENT", "404.md", "no such file"], [])
  useRegisterChrome("404.md", statusItems)

  return (
    <StyledWrapper>
      <TabBar tabs={TABS} activeIdx={0} />

      <div className="center">
        <div className="inner">
          <div className="route-label"># /errors/404.md</div>

          <div className="big-error">
            <div className="digits">
              4<span className="zero">0</span>4
            </div>
            <div className="message">
              <div className="fatal">
                <span className="fatal-label">fatal:</span> path not found in working tree.
              </div>
              <div className="hint">
                <span className="comment">{"// "}</span>maybe a draft, maybe a dream.
              </div>
            </div>
          </div>

          <div className="shortcuts">
            <div className="shortcuts-label">try one of</div>
            {SHORTCUTS.map(([key, desc]) => (
              <div key={key} className="shortcut-row">
                <span className="key">{key}</span>
                <span className="desc">{desc}</span>
              </div>
            ))}
          </div>

          <Link href="/" className="back-link">← back to home</Link>
        </div>
      </div>
    </StyledWrapper>
  )
}

export default CustomError

const StyledWrapper = styled.div`
  display: flex;
  flex-direction: column;
  flex: 1;
  min-height: 0;
  overflow: hidden;

  .center {
    flex: 1;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 40px;
    overflow-y: auto;
  }

  .inner {
    max-width: 560px;
    width: 100%;
  }

  .route-label {
    font-family: var(--font-mono, monospace);
    font-size: 12px;
    color: ${({ theme }) => theme.colors.editor.accent};
    margin-bottom: 8px;
  }

  .big-error {
    display: grid;
    grid-template-columns: auto 1fr;
    gap: 28px;
    align-items: center;
    padding: 28px 0;
    border-top: 1px solid ${({ theme }) => theme.colors.editor.line};
    border-bottom: 1px solid ${({ theme }) => theme.colors.editor.line};
    margin-bottom: 24px;

    .digits {
      font-family: var(--font-mono, monospace);
      font-size: 120px;
      font-weight: 500;
      color: ${({ theme }) => theme.colors.editor.fg};
      line-height: 0.9;
      letter-spacing: -4px;

      .zero { color: ${({ theme }) => theme.colors.editor.accent}; }
    }

    .message {
      font-family: var(--font-mono, monospace);
      font-size: 13px;
      color: ${({ theme }) => theme.colors.editor.fg2};
      line-height: 1.7;

      .fatal-label { color: ${({ theme }) => theme.colors.editor.accent2}; }
      .comment { color: ${({ theme }) => theme.colors.editor.fg3}; }
    }
  }

  .shortcuts {
    margin-bottom: 24px;

    .shortcuts-label {
      font-family: var(--font-mono, monospace);
      font-size: 12px;
      color: ${({ theme }) => theme.colors.editor.fg3};
      letter-spacing: 1.2px;
      text-transform: uppercase;
      margin-bottom: 8px;
    }

    .shortcut-row {
      display: flex;
      align-items: center;
      gap: 12px;
      padding: 6px 0;
      border-bottom: 1px solid ${({ theme }) => theme.colors.editor.line};
      font-family: var(--font-mono, monospace);
      font-size: 12px;

      .key {
        padding: 2px 8px;
        background: ${({ theme }) => theme.colors.editor.bg2};
        border: 1px solid ${({ theme }) => theme.colors.editor.line2};
        border-radius: 3px;
        color: ${({ theme }) => theme.colors.editor.fg};
        min-width: 36px;
        text-align: center;
      }

      .desc { color: ${({ theme }) => theme.colors.editor.fg2}; }
    }
  }

  .back-link {
    font-family: var(--font-mono, monospace);
    font-size: 12px;
    color: ${({ theme }) => theme.colors.editor.accent3};
    text-decoration: none;
    &:hover { color: ${({ theme }) => theme.colors.editor.accent}; }
  }
`
