import styled from "@emotion/styled"

type Props = {
  filename: string
}

const exitSite = () => {
  window.close()
  if (!window.closed) window.location.replace("about:blank")
}

const TitleBar = ({ filename }: Props) => (
  <StyledWrapper>
    <div className="traffic-lights">
      <button type="button" className="window-close" aria-label="사이트 닫기 / 나가기" title="사이트 닫기 / 나가기" onClick={exitSite}>
        <span className="dot close" aria-hidden="true" />
      </button>
      <span className="dot" aria-hidden="true" />
      <span className="dot" aria-hidden="true" />
    </div>
    <div className="title">pieroot.log — {filename}</div>
    <div className="branch">main</div>
  </StyledWrapper>
)

export default TitleBar

const StyledWrapper = styled.div`
  height: ${({ theme }) => theme.variables.titleBarHeight}px;
  background: ${({ theme }) => theme.colors.editor.bg2};
  border-bottom: 1px solid ${({ theme }) => theme.colors.editor.line};
  position: sticky;
  top: 0;
  z-index: 40;
  display: flex;
  align-items: center;
  padding: 0 14px;
  flex-shrink: 0;

  > * + * { margin-left: 10px; }

  .traffic-lights {
    display: flex;
    align-items: center;
    .window-close {
      all: unset;
      display: grid;
      place-items: center;
      width: 24px;
      height: 24px;
      cursor: pointer;
      border-radius: 4px;
      &:hover { background: ${({ theme }) => theme.colors.editor.bg3}; }
      &:focus-visible { outline: 2px solid ${({ theme }) => theme.colors.editor.accent}; }
      &:active .dot { transform: scale(0.85); }
    }
    > * + * { margin-left: 6px; }
    .dot {
      width: 10px;
      height: 10px;
      border-radius: 50%;
      background: ${({ theme }) => theme.colors.editor.fg4};
      animation: monolog-dot-arrive 320ms var(--motion-ease);
      &:nth-child(2) { animation-delay: 45ms; }
      &:nth-child(3) { animation-delay: 90ms; }
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

  .branch {
    font-size: 11px;
    color: ${({ theme }) => theme.colors.editor.fg3};
    white-space: nowrap;
  }

  @media (prefers-reduced-motion: reduce) {
    .traffic-lights .dot { animation: none; }
  }
`
