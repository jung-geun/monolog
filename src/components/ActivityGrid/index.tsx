import styled from "@emotion/styled"

type Props = {
  grid: number[][]
}

const ActivityGrid = ({ grid }: Props) => (
  <StyledWrapper>
    {grid.map((col, i) => (
      <div key={i} className="col">
        {col.map((level, j) => (
          <div key={j} className={`cell level-${level}`} />
        ))}
      </div>
    ))}
  </StyledWrapper>
)

export default ActivityGrid

const StyledWrapper = styled.div`
  display: flex;
  gap: 2px;

  .col {
    display: flex;
    flex-direction: column;
    gap: 2px;
  }

  .cell {
    width: 9px;
    height: 9px;
    border-radius: 1px;
    background: ${({ theme }) => theme.colors.editor.bg3};

    &.level-1 { background: ${({ theme }) => theme.colors.editor.accent}; opacity: 0.25; }
    &.level-2 { background: ${({ theme }) => theme.colors.editor.accent}; opacity: 0.5; }
    &.level-3 { background: ${({ theme }) => theme.colors.editor.accent}; opacity: 0.75; }
    &.level-4 { background: ${({ theme }) => theme.colors.editor.accent}; opacity: 1; }
  }
`
