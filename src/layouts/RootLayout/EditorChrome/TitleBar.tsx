import styled from "@emotion/styled"
import { CONFIG } from "site.config"

type Props = {
  filename: string
}

const TitleBar = ({ filename }: Props) => (
  <StyledWrapper>
    <div className="traffic-lights">
      <span className="dot close" />
      <span className="dot" />
      <span className="dot" />
    </div>
    <div className="title">pieroot.log — {filename}</div>
    <div className="controls">
      <a href="https://www.buymeacoffee.com/junggeun" target="_blank" rel="noreferrer">
        Support
      </a>
      <a
        className="github-link"
        href={`https://github.com/${CONFIG.profile.github}`}
        target="_blank"
        rel="noreferrer"
      >
        GitHub
      </a>
      <span className="branch">main</span>
    </div>
  </StyledWrapper>
)

export default TitleBar

const StyledWrapper = styled.div`
  height: ${({ theme }) => theme.variables.titleBarHeight}px;
  background: ${({ theme }) => theme.colors.editor.bg2};
  border-bottom: 1px solid ${({ theme }) => theme.colors.editor.line};
  display: flex;
  align-items: center;
  padding: 0 14px;
  flex-shrink: 0;

  > * + * { margin-left: 10px; }

  .traffic-lights {
    display: flex;
    > * + * { margin-left: 6px; }
    .dot {
      width: 10px;
      height: 10px;
      border-radius: 50%;
      background: ${({ theme }) => theme.colors.editor.fg4};
      &.close {
        background: #e8a04a;
      }
    }
  }

  .title {
    flex: 1;
    text-align: center;
    font-size: 11px;
    color: ${({ theme }) => theme.colors.editor.fg3};
    font-family: var(--font-mono, monospace);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .controls {
    display: flex;
    align-items: center;
    gap: 10px;
    font-size: 11px;
    white-space: nowrap;

    a,
    .branch { color: ${({ theme }) => theme.colors.editor.fg3}; }
    a {
      text-decoration: none;
      &:hover { color: ${({ theme }) => theme.colors.editor.fg}; }
    }
  }

  @media (max-width: ${({ theme }) => theme.variables.breakpoint}px) {
    .github-link,
    .branch { display: none; }
  }
`
