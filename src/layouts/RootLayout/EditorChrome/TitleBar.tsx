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
        <span className="dot close" aria-hidden="true">
          <svg width="8" height="8" viewBox="0 0 8 8" fill="none">
            <path d="M2 2l4 4m0-4L2 6" stroke="currentColor" strokeWidth="1.2" />
          </svg>
        </span>
      </button>
      <span className="dot minimize" aria-hidden="true" />
      <span className="dot maximize" aria-hidden="true" />
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
    gap: 8px;
    flex-shrink: 0;

    .window-close {
      all: unset;
      position: relative;
      display: grid;
      place-items: center;
      width: 12px;
      height: 12px;
      cursor: default;
      border-radius: 50%;

      &::before { content: ""; position: absolute; inset: -4px; border-radius: 50%; }
      &:focus-visible { outline: 2px solid ${({ theme }) => theme.colors.editor.accent}; outline-offset: 3px; }
      &:active .dot { filter: brightness(0.82); }
    }

    .dot {
      display: grid;
      place-items: center;
      box-sizing: border-box;
      width: 12px;
      height: 12px;
      border: 1px solid;
      border-radius: 50%;
      box-shadow: inset 0 0.5px 0 rgba(255, 255, 255, 0.35);
      animation: monolog-dot-arrive 320ms var(--motion-ease);

      &.close { background: #ff5f57; border-color: #e0443e; color: #4b0b08; }
      &.minimize { background: #febc2e; border-color: #dea123; animation-delay: 45ms; }
      &.maximize { background: #28c840; border-color: #1aab29; animation-delay: 90ms; }
    }

    svg { opacity: 0; transition: opacity var(--motion-fast); }
    &:hover svg, &:focus-within svg { opacity: 1; }
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
