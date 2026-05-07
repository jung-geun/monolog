import styled from "@emotion/styled"

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
    <div className="branch">main</div>
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

  .branch {
    font-size: 11px;
    color: ${({ theme }) => theme.colors.editor.fg3};
    white-space: nowrap;
  }
`
