import styled from "@emotion/styled"

type Props = {
  title: string
  date: string
  category?: string
  tags?: string[]
  readTime?: number
}

const Frontmatter = ({ title, date, category, tags, readTime }: Props) => (
  <StyledWrapper>
    <div>---</div>
    <div><span className="key">title</span>: {title}</div>
    <div><span className="key">date</span>: {date}</div>
    {category && <div><span className="key">category</span>: {category}</div>}
    {tags && tags.length > 0 && (
      <div><span className="key">tags</span>: [{tags.join(", ")}]</div>
    )}
    {readTime !== undefined && (
      <div><span className="key">read</span>: {readTime}m</div>
    )}
    <div>---</div>
  </StyledWrapper>
)

export default Frontmatter

const StyledWrapper = styled.div`
  font-family: var(--font-mono, monospace);
  font-size: 13px;
  color: ${({ theme }) => theme.colors.editor.fg3};
  margin-bottom: 24px;
  line-height: 1.7;

  .key {
    color: ${({ theme }) => theme.colors.editor.accent3};
  }
`
