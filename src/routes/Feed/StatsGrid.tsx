import styled from "@emotion/styled"
import { BlogStats } from "src/libs/utils/stats"

type Props = {
  stats: BlogStats
}

const StatsGrid = ({ stats }: Props) => {
  const words =
    stats.words >= 1000
      ? `${(stats.words / 1000).toFixed(1)}k`
      : String(stats.words)

  const items = [
    { key: "entries", value: stats.posts, hint: `since ${new Date().getFullYear() - 1}` },
    { key: "categories", value: stats.categories, hint: "by topic" },
    { key: "tags", value: stats.tags, hint: "loosely coupled" },
    { key: "words", value: words, hint: "≈ good reading" },
  ]

  return (
    <StyledWrapper>
      {items.map(({ key, value, hint }) => (
        <div key={key} className="cell">
          <div className="label">{key}</div>
          <div className="value">{value}</div>
          <div className="hint">{hint}</div>
        </div>
      ))}
    </StyledWrapper>
  )
}

export default StatsGrid

const StyledWrapper = styled.div`
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  border: 1px solid ${({ theme }) => theme.colors.editor.line};
  margin-bottom: 36px;
  font-family: var(--font-mono, monospace);

  .cell {
    padding: 16px 18px;
    border-right: 1px solid ${({ theme }) => theme.colors.editor.line};

    &:last-child { border-right: none; }

    .label {
      font-size: 11px;
      color: ${({ theme }) => theme.colors.editor.fg3};
      text-transform: uppercase;
      letter-spacing: 1.2px;
    }

    .value {
      font-size: 28px;
      font-weight: 500;
      color: ${({ theme }) => theme.colors.editor.fg};
      margin: 4px 0;
    }

    .hint {
      font-size: 11px;
      color: ${({ theme }) => theme.colors.editor.fg3};
    }
  }

  @media (max-width: 600px) {
    grid-template-columns: repeat(2, 1fr);
    .cell:nth-of-type(2) { border-right: none; }
  }
`
