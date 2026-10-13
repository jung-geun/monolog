import { Fragment, useId, useMemo, useRef, useState, type KeyboardEvent } from "react"
import Link from "next/link"
import { useRouter } from "next/router"
import styled from "@emotion/styled"
import FileIcon from "src/components/FileIcon"
import WorkbenchIcon from "src/components/WorkbenchIcon"
import usePostsQuery from "src/hooks/usePostsQuery"
import { highlightRanges, matchPost, parseSearchQuery, type SearchField, type SearchTerm } from "./query"

function Highlight({ text, terms, field }: { text: string; terms: SearchTerm[]; field: Exclude<SearchField, "all"> }) {
  const ranges = highlightRanges(text, terms, field)
  return <>{ranges.map(([start, stop], index) => {
    const prefix = text.slice(index === 0 ? 0 : ranges[index - 1][1], start)
    return <Fragment key={`${start}-${stop}`}>{prefix}<mark>{text.slice(start, stop)}</mark></Fragment>
  })}{text.slice(ranges.length ? ranges[ranges.length - 1][1] : 0)}</>
}

export default function SearchExperience({ query, onQueryChange, sidebar = false, onEscape, onSelect, field = "all", onFieldChange }: {
  query: string
  onQueryChange: (value: string) => void
  sidebar?: boolean
  onEscape?: () => void
  onSelect?: () => void
  field?: SearchField
  onFieldChange?: (field: SearchField) => void
}) {
  const posts = usePostsQuery()
  const router = useRouter()
  const input = useRef<HTMLInputElement>(null)
  const results = useRef<(HTMLAnchorElement | null)[]>([])
  const [active, setActive] = useState(-1)
  const id = useId()
  const terms = useMemo(() => parseSearchQuery(query), [query])
  const hits = useMemo(() => posts.filter(post => matchPost(post, terms, field)), [posts, terms, field])

  const focusResult = (index: number) => {
    setActive(index)
    if (index < 0) input.current?.focus()
    else results.current[index]?.focus()
  }
  const keyDown = (event: KeyboardEvent, index: number) => {
    if (event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) return
    if (event.key === "ArrowDown" && hits.length) {
      event.preventDefault()
      focusResult(Math.min(index + 1, hits.length - 1))
    } else if (event.key === "ArrowUp") {
      event.preventDefault()
      focusResult(index < 0 ? hits.length - 1 : index - 1)
    } else if (event.key === "Enter" && index === -1 && hits.length) {
      event.preventDefault()
      onSelect?.()
      void router.push(`/${hits[Math.max(0, active)]?.slug ?? hits[0].slug}`)
    } else if (event.key === "Escape") {
      event.preventDefault()
      if (query) {
        onQueryChange("")
        focusResult(-1)
      } else if (onEscape) onEscape()
      else input.current?.blur()
    }
  }

  return <StyledSearch data-sidebar={sidebar}>
    <div className="search-field">
      <WorkbenchIcon name="search" />
      <input ref={input} type="search" value={query} aria-label="Search publication metadata" aria-controls={`${id}-results`}
        aria-describedby={`${id}-help`} placeholder="Search titles, summaries, tags…"
        onChange={event => { setActive(-1); onQueryChange(event.target.value) }}
        onKeyDown={event => keyDown(event, -1)} />
      {query && <button type="button" aria-label="Clear search" onClick={() => { onQueryChange(""); focusResult(-1) }}><WorkbenchIcon name="close" /></button>}
    </div>
    <p className="help" id={`${id}-help`}>Titles, summaries, tags and categories. Use <code>tag:rust</code> or <code>category:systems</code>; quote values with spaces.</p>
    {!sidebar && onFieldChange && <div className="facets" aria-label="Search fields">
      {(["all", "title", "summary", "tags", "category"] as SearchField[]).map(value => <button type="button" key={value} aria-pressed={field === value}
        onClick={() => { onFieldChange(value); setActive(-1) }}>{value === "all" ? "All fields" : value}</button>)}
    </div>}
    <div className="result-status" role="status">{hits.length} {hits.length === 1 ? "entry" : "entries"}{query ? " found" : " · all publications"}</div>
    <ul id={`${id}-results`} className="results" aria-label="Search results">
      {hits.map((post, index) => <li key={post.id}>
        <Link href={`/${post.slug}`} prefetch={false} ref={element => { results.current[index] = element }}
          onFocus={() => setActive(index)} onClick={onSelect} onKeyDown={event => keyDown(event, index)}>
          <FileIcon name={`${post.slug}.md`} />
          <div className="result-content">
            <span className="result-title"><Highlight text={post.title} terms={terms} field="title" /></span>
            {post.summary && <p className="summary"><Highlight text={post.summary} terms={terms} field="summary" /></p>}
            <div className="metadata">
              {(post.category ?? []).map(category => <span key={`category-${category}`}><Highlight text={category} terms={terms} field="category" /></span>)}
              {(post.tags ?? []).map(tag => <span key={`tag-${tag}`}>#<Highlight text={tag} terms={terms} field="tags" /></span>)}
              {!sidebar && <time>{(post.date?.start_date || post.createdTime || "").slice(0, 10)}</time>}
            </div>
          </div>
          {!sidebar && <WorkbenchIcon name="arrow-right" />}
        </Link>
      </li>)}
    </ul>
    {!hits.length && <p className="empty">{query ? "No matching publications. Try fewer terms or another tag." : "No publications available."}</p>}
    <p className="keyboard">↑ / ↓ move to results · Enter opens · Escape clears{sidebar ? " or closes the sidebar" : " search"}</p>
    {sidebar && <Link className="open-editor" href={{ pathname: "/search", query: query ? { q: query } : {} }} onClick={onSelect}><WorkbenchIcon name="external" /> Open Search Editor</Link>}
  </StyledSearch>
}

const StyledSearch = styled.div`
  font-family: var(--font-ui, sans-serif);
  font-size: 13px;
  color: ${({ theme }) => theme.colors.editor.fg};
  .search-field { display: flex; align-items: center; gap: 8px; padding: 6px 8px; background: ${({ theme }) => theme.colors.editor.bg3}; border: 1px solid ${({ theme }) => theme.colors.editor.line}; }
  .search-field:focus-within { border-color: ${({ theme }) => theme.colors.editor.accent}; }
  input { width: 100%; min-width: 0; background: transparent; border: 0; outline: 0; font: inherit; color: inherit; }
  button { color: inherit; font: inherit; cursor: pointer; background: transparent; border: 0; }
  .search-field button { display: flex; padding: 2px; }
  .help, .keyboard { color: ${({ theme }) => theme.colors.editor.fg3}; font-size: 11px; line-height: 1.6; margin: 10px 0; }
  code { font: 10px var(--font-mono, monospace); color: ${({ theme }) => theme.colors.editor.fg2}; }
  .facets { display: flex; gap: 5px; flex-wrap: wrap; margin: 16px 0; }
  .facets button { padding: 4px 8px; border: 1px solid ${({ theme }) => theme.colors.editor.line}; }
  .facets button[aria-pressed=true] { background: ${({ theme }) => theme.colors.editor.accentSoft}; color: ${({ theme }) => theme.colors.editor.accent}; border-color: ${({ theme }) => theme.colors.editor.accent}; }
  .result-status { color: ${({ theme }) => theme.colors.editor.fg3}; font-size: 11px; margin: 16px 0 8px; font-variant-numeric: tabular-nums; }
  .results { list-style: none; margin: 0; padding: 0; }
  .results a { display: flex; align-items: flex-start; gap: 10px; padding: 10px 8px; text-decoration: none; color: inherit; border-bottom: 1px solid ${({ theme }) => theme.colors.editor.line}; }
  .results a:hover, .results a:focus { background: ${({ theme }) => theme.colors.editor.bg3}; }
  .results a > svg, .results a > img { flex-shrink: 0; margin-top: 2px; }
  .result-content { flex: 1; min-width: 0; }
  .result-title { display: block; font-weight: 500; line-height: 1.5; overflow-wrap: anywhere; }
  .summary { color: ${({ theme }) => theme.colors.editor.fg2}; font-size: 12px; margin: 4px 0; line-height: 1.6; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; }
  .metadata { display: flex; flex-wrap: wrap; gap: 4px 10px; font-size: 11px; line-height: 1.5; margin-top: 3px; color: ${({ theme }) => theme.colors.editor.fg3}; }
  .metadata time { margin-left: auto; font-variant-numeric: tabular-nums; }
  mark { color: ${({ theme }) => theme.colors.editor.fg}; background: ${({ theme }) => theme.colors.editor.accentSoft}; box-shadow: inset 0 -1px ${({ theme }) => theme.colors.editor.accent}; }
  .empty { color: ${({ theme }) => theme.colors.editor.fg2}; padding: 20px 0; }
  .open-editor { display: flex; align-items: center; gap: 6px; padding: 8px 0; color: ${({ theme }) => theme.colors.editor.accent}; text-decoration: none; }
  a:focus-visible, button:focus-visible { outline: 1px solid ${({ theme }) => theme.colors.editor.accent}; outline-offset: -1px; }
  &[data-sidebar=true] { .results a { padding: 8px 2px; gap: 6px; } .summary { -webkit-line-clamp: 1; font-size: 11px; } .result-title { font-size: 12px; } .metadata { font-size: 10px; } }
`
