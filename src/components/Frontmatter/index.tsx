import styled from "@emotion/styled"
import { CONFIG } from "site.config"
import { calendarDate } from "src/libs/seo"

type Props = {
  title: string
  date?: string
  modifiedDate?: string
  authors?: string[]
  category?: string
  tags?: string[]
  readTime?: number
}

const Frontmatter = ({ title, date, modifiedDate, authors, category, tags, readTime }: Props) => (
  <StyledWrapper>
    <summary>Frontmatter <span className="metadata-summary">{date ? calendarDate(date) : category || "metadata"}{tags?.length ? ` · ${tags.length} tags` : ""}</span></summary>
    <div className="metadata-fields">
    <div>---</div>
    <div><span className="key">title</span>: {title}</div>
    <div><span className="key">author</span>: {authors?.length ? authors.join(", ") : CONFIG.profile.name}</div>
    {date && (
      <div><span className="key">date</span>: <time dateTime={date}>{calendarDate(date)}</time></div>
    )}
    {modifiedDate && (
      <div><span className="key">modified</span>: <time dateTime={modifiedDate}>{calendarDate(modifiedDate)}</time></div>
    )}
    {category && <div><span className="key">category</span>: {category}</div>}
    {tags && tags.length > 0 && (
      <div><span className="key">tags</span>: [{tags.join(", ")}]</div>
    )}
    {readTime !== undefined && (
      <div><span className="key">read</span>: {readTime}m</div>
    )}
    <div>---</div>
    </div>
  </StyledWrapper>
)

export default Frontmatter

const StyledWrapper = styled.details`
  font-family: var(--font-mono, "JetBrains Mono", monospace);
  font-size: 13px;
  color: var(--color-mute, rgb(var(--c-mute)));
  margin-bottom: 20px;
  line-height: 1.6;
  summary { cursor: pointer; padding: 7px 0; color: ${({ theme }) => theme.colors.editor.fg2}; }
  summary:focus-visible { outline: 2px solid ${({ theme }) => theme.colors.editor.accent}; outline-offset: 3px; }
  .metadata-summary { margin-left: 10px; color: ${({ theme }) => theme.colors.editor.fg3}; font-size: 11px; }
  .metadata-fields { padding: 8px 12px; border-left: 1px solid ${({ theme }) => theme.colors.editor.line}; overflow-wrap: anywhere; }

  .key {
    color: var(--color-signal, rgb(var(--c-signal)));
  }
`
