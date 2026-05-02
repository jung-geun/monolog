import styled from "@emotion/styled"

type Props = {
  count?: number
}

const LineNumberGutter = ({ count = 80 }: Props) => (
  <StyledWrapper aria-hidden="true">
    {Array.from({ length: count }, (_, i) => (
      <div key={i + 1}>{i + 1}</div>
    ))}
  </StyledWrapper>
)

export default LineNumberGutter

const StyledWrapper = styled.div`
  width: ${({ theme }) => theme.variables.gutterWidth}px;
  background: ${({ theme }) => theme.colors.editor.gutter};
  border-right: 1px solid ${({ theme }) => theme.colors.editor.line};
  text-align: right;
  padding: 30px 10px 60px;
  color: ${({ theme }) => theme.colors.editor.fg4};
  font-size: 12px;
  font-family: var(--font-mono, monospace);
  line-height: 1.7;
  user-select: none;
  flex-shrink: 0;
  overflow: hidden;

  @media (max-width: ${({ theme }) => theme.variables.breakpoint}px) {
    display: none;
  }
`
