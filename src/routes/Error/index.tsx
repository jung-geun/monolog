import { useMemo } from "react"
import styled from "@emotion/styled"
import Link from "next/link"
import { CONFIG } from "site.config"
import MetaConfig from "src/components/MetaConfig"
import WorkbenchIcon from "src/components/WorkbenchIcon"
import { useRegisterChrome } from "src/layouts/RootLayout/EditorChrome/RouteChromeContext"

type ErrorPageProps = { statusCode?: number | null }
type ErrorMessage = { title: string; description: string }

const messages: Record<number, ErrorMessage> = {
  400: { title: "Bad request", description: "This address could not be read. Check the URL and try again." },
  401: { title: "Authentication required", description: "You need permission to open this page. Return to the public workspace." },
  403: { title: "Access denied", description: "This page is not available to you. You can still browse public posts." },
  404: { title: "Page not found", description: "The address may be incorrect, or this page may have moved." },
  405: { title: "Method not allowed", description: "This page does not support that request. Open it from the workspace." },
  408: { title: "Request timed out", description: "The request took too long. Reload the page to try again." },
  410: { title: "Page no longer available", description: "This page has been removed. Search the workspace for another post." },
  429: { title: "Too many requests", description: "Please wait a moment before reloading this page." },
  500: { title: "Internal server error", description: "We could not open this page. Please try again in a moment." },
  502: { title: "Bad gateway", description: "An upstream service could not respond. Please try again in a moment." },
  503: { title: "Service unavailable", description: "The workspace is temporarily unavailable. Please try again shortly." },
  504: { title: "Gateway timed out", description: "An upstream service took too long to respond. Please try again shortly." },
}

// Six-by-eight bitmap glyphs keep the error artwork sharp at every editor width.
const glyphs: Record<string, string[]> = {
  "0": ["011110", "100001", "100001", "100001", "100001", "100001", "100001", "011110"],
  "1": ["001100", "011100", "001100", "001100", "001100", "001100", "001100", "111111"],
  "2": ["011110", "100001", "000001", "000010", "001100", "010000", "100000", "111111"],
  "3": ["111110", "000001", "000001", "011110", "000001", "000001", "000001", "111110"],
  "4": ["000010", "000110", "001010", "010010", "100010", "111111", "000010", "000010"],
  "5": ["111111", "100000", "100000", "111110", "000001", "000001", "100001", "011110"],
  "6": ["011110", "100000", "100000", "111110", "100001", "100001", "100001", "011110"],
  "7": ["111111", "000001", "000010", "000100", "001000", "001000", "001000", "001000"],
  "8": ["011110", "100001", "100001", "011110", "100001", "100001", "100001", "011110"],
  "9": ["011110", "100001", "100001", "011111", "000001", "000001", "000001", "011110"],
  E: ["111111", "100000", "100000", "111110", "100000", "100000", "100000", "111111"],
  R: ["111110", "100001", "100001", "111110", "101000", "100100", "100010", "100001"],
}

const ErrorPage = ({ statusCode = 404 }: ErrorPageProps) => {
  const status = typeof statusCode === "number" && Number.isInteger(statusCode) && statusCode >= 400 && statusCode <= 599 ? statusCode : null
  const code = status === null ? "ERR" : String(status)
  const message = status === null
    ? { title: "Application error", description: "This page could not be displayed. Reload it to start again." }
    : messages[status] ?? {
      title: status >= 500 ? "Server error" : "Request error",
      description: "This page could not be opened. Return to the workspace or try again.",
    }
  const filename = status === null ? "Application error" : `${status} ${message.title}`
  const statusItems = useMemo(() => [code, message.title, "Read-only workspace"], [code, message.title])
  useRegisterChrome(filename, statusItems, "error")
  const retryable = status === null || status >= 500 || status === 408 || status === 429

  return (
    <>
      <MetaConfig
        title={`${filename} | ${CONFIG.blog.title}`}
        description={message.description}
        type="website"
        url={`${CONFIG.link}/${status ?? 500}`}
        noindex
      />
      <StyledWrapper aria-labelledby="error-title" data-error-code={code}>
        <div className="error-content">
          <svg className="error-art" viewBox="0 0 20 8" fill="currentColor" shapeRendering="crispEdges" aria-hidden="true" focusable="false">
            {Array.from(code, (character, digit) => (
              <g key={digit} transform={`translate(${digit * 7} 0)`}>
                {glyphs[character].flatMap((row, y) => Array.from(row, (pixel, x) => pixel === "1"
                  ? <rect key={`${x}-${y}`} x={x + 0.04} y={y + 0.04} width="0.92" height="0.92" />
                  : null))}
              </g>
            ))}
          </svg>
          <span className="error-label">{status === null ? "CLIENT ERROR" : `HTTP ${status}`}</span>
          <h1 id="error-title">{message.title}</h1>
          <p>{message.description}</p>
          <nav className="error-actions" aria-label="Error recovery">
            <Link href="/" className="home-link">Return home<WorkbenchIcon name="arrow-right" /></Link>
            {retryable
              ? <button type="button" onClick={() => window.location.reload()}>Reload page<WorkbenchIcon name="history" /></button>
              : <Link href="/search">Search posts<WorkbenchIcon name="search" /></Link>}
          </nav>
        </div>
      </StyledWrapper>
    </>
  )
}

export default ErrorPage

const StyledWrapper = styled.main`
  flex: 1;
  min-width: 0;
  display: grid;
  place-items: center;
  padding: clamp(32px, 5cqw, 64px) 24px;
  color: ${({ theme }) => theme.colors.editor.fg};
  text-align: center;

  .error-content { width: 100%; max-width: 760px; }
  .error-art { display: block; width: 100%; height: auto; margin: 0 auto clamp(28px, 4cqw, 48px); }
  .error-label {
    display: inline-block;
    padding: 4px 8px;
    background: ${({ theme }) => theme.colors.editor.bg3};
    color: ${({ theme }) => theme.colors.editor.fg2};
    font: 11px var(--font-mono, monospace);
    letter-spacing: 0.04em;
  }
  h1 { margin: 18px 0 10px; font-size: clamp(24px, 3.5cqw, 36px); font-weight: 400; line-height: 1.2; letter-spacing: -0.03em; }
  p { max-width: 48ch; margin: 0 auto; color: ${({ theme }) => theme.colors.editor.fg2}; font-size: 14px; line-height: 1.7; text-wrap: pretty; }
  .error-actions { display: flex; flex-wrap: wrap; justify-content: center; align-items: center; gap: 12px 24px; margin-top: 28px; }
  a, button { display: inline-flex; align-items: center; justify-content: center; gap: 10px; min-height: 44px; padding: 10px 14px; color: inherit; background: transparent; border: 1px solid transparent; text-decoration: none; font: 11px var(--font-mono, monospace); cursor: pointer; }
  .home-link { border: 2px dotted ${({ theme }) => theme.colors.editor.fg3}; }
  a:hover, button:hover { background: ${({ theme }) => theme.colors.editor.bg3}; }
  a:active, button:active { transform: translateY(1px); }
  a:focus-visible, button:focus-visible { outline: 2px solid ${({ theme }) => theme.colors.editor.accent}; outline-offset: 4px; }
  @container editor (max-width: 480px) {
    padding: 32px 20px;
    .error-art { margin-bottom: 32px; }
    p { font-size: 13px; }
    .error-actions { gap: 8px; }
  }
`
