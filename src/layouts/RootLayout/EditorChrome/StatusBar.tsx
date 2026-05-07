import { useState, useEffect } from "react"
import styled from "@emotion/styled"
import { keyframes } from "@emotion/react"

type Props = {
  items: string[]
}

const pulse = keyframes`
  0%, 100% { opacity: 1; }
  50% { opacity: 0.4; }
`

const StatusBar = ({ items }: Props) => {
  const [ip, setIp] = useState("0.0.0.0")

  useEffect(() => {
    let cancelled = false
    fetch("https://api.ipify.org?format=json")
      .then((r) => r.json())
      .then((d) => { if (!cancelled) setIp(d.ip) })
      .catch(() => {})
    return () => { cancelled = true }
  }, [])

  return (
    <StyledWrapper>
      <div className="ssh-segment">
        <span className="dot" />
        <span className="ssh-label">ssh</span>
        <span className="host">pieroot@log</span>
        <span className="sep">·</span>
        <span className="ip">{ip}</span>
      </div>
      <div className="accent-strip">
        {items.map((item, i) => (
          <span
            key={i}
            className={i === items.length - 1 ? "last" : ""}
            style={{ fontWeight: i === 0 ? 600 : 400 }}
          >
            {item}
          </span>
        ))}
      </div>
    </StyledWrapper>
  )
}

export default StatusBar

const StyledWrapper = styled.div`
  position: relative;
  flex-shrink: 0;
  width: 100%;
  height: ${({ theme }) => theme.variables.statusBarHeight}px;
  display: flex;
  align-items: stretch;
  font-family: var(--font-mono, monospace);
  font-size: 11px;

  .ssh-segment {
    background: #1c1d1a;
    color: #a8e0a0;
    display: flex;
    align-items: center;
    padding: 0 10px 0 12px;
    border-right: 1px solid rgba(255, 255, 255, 0.12);
    white-space: nowrap;
    flex-shrink: 0;

    > * + * { margin-left: 8px; }

    .dot {
      width: 6px;
      height: 6px;
      border-radius: 50%;
      background: #5ad17a;
      box-shadow: 0 0 6px #5ad17a;
      flex-shrink: 0;
      animation: ${pulse} 3s ease-in-out infinite;
    }
    .ssh-label { color: #5ad17a; }
    .host { color: #a8e0a0; }
    .sep { color: #7a8c74; }
    .ip { color: #cfcfcf; }
  }

  .accent-strip {
    flex: 1;
    background: ${({ theme }) => theme.colors.editor.accent};
    color: #1c1d1a;
    display: flex;
    align-items: center;
    padding: 0 12px;
    min-width: 0;
    overflow: hidden;
    flex-wrap: nowrap;

    > span {
      white-space: nowrap;
      flex-shrink: 0;
    }

    > span + span {
      margin-left: 16px;
    }

    .last {
      margin-left: auto;
    }
  }

  @media (max-width: ${({ theme }) => theme.variables.breakpoint}px) {
    .ssh-segment {
      padding: 0 8px;
      .ip { display: none; }
      .sep { display: none; }
      > * + * { margin-left: 4px; }
    }
    .accent-strip {
      padding: 0 10px;
      > span + span { margin-left: 8px; }
      > span:not(:first-of-type):not(:last-of-type) {
        display: none;
      }
    }
  }
`
