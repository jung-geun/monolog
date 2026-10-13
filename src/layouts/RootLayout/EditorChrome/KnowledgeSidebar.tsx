import { useState } from "react"
import Link from "next/link"
import styled from "@emotion/styled"
import FileIcon from "src/components/FileIcon"
import { variables } from "src/styles/variables"
import WorkbenchIcon from "src/components/WorkbenchIcon"
import { useTagsQuery } from "src/hooks/useTagsQuery"
import { useSeriesQuery } from "src/hooks/useSeriesQuery"
import { useCategoriesQuery } from "src/hooks/useCategoriesQuery"
import { DEFAULT_CATEGORY } from "src/constants"
import { useWorkbench } from "./WorkbenchContext"
import { useRouteChrome } from "./RouteChromeContext"

export default function KnowledgeSidebar() {
  const tags = useTagsQuery()
  const series = useSeriesQuery()
  const categories = useCategoriesQuery()
  const [filter, setFilter] = useState("")
  const { setSidebarView } = useWorkbench()
  const { setFileTreeOpen } = useRouteChrome()
  const selected = () => { if (window.matchMedia(`(max-width: ${variables.breakpoint}px)`).matches) setFileTreeOpen(false) }

  return <StyledSidebar aria-label="Knowledge sidebar">
    <header><h2>KNOWLEDGE</h2><button type="button" aria-label="Return to Explorer" title="Return to Explorer" onClick={() => setSidebarView("explorer")}><WorkbenchIcon name="files" /></button></header>
    <div className="content">
      <nav aria-label="Knowledge editors" className="editors">
        <Link href="/graph" onClick={selected}><WorkbenchIcon name="graph" /><span>Knowledge graph<small>Posts, references, tags and series</small></span></Link>
        <Link href="/ontology" onClick={selected}><WorkbenchIcon name="link" /><span>Ontology<small>Entities and inferred relations</small></span></Link>
      </nav>
      <label className="filter"><WorkbenchIcon name="search" /><input type="search" aria-label="Filter tags, categories and series" placeholder="Filter knowledge…" value={filter} onChange={event => setFilter(event.target.value)} onKeyDown={event => { if (event.key === "Escape") setFilter("") }} /></label>
      {([
        { title: "Tags", values: tags, href: (name: string) => `/search?q=${encodeURIComponent(`tag:${JSON.stringify(name)}`)}` },
        { title: "Categories", values: categories, href: (name: string) => `/categories/${encodeURIComponent(name)}` },
        { title: "Series", values: series, href: (name: string) => `/series/${encodeURIComponent(name)}` },
      ]).map(section => {
        const items = Object.entries(section.values)
          .filter(([name]) => (section.title !== "Categories" || name !== DEFAULT_CATEGORY) && name.toLowerCase().includes(filter.toLowerCase()))
          .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], "ko"))
        return <details key={section.title} open className="section"><summary><WorkbenchIcon name="chevron-right" /><span>{section.title}</span><small>{items.length}</small></summary>
          <ul>{items.map(([name, count]) => <li key={name}><Link href={section.href(name)} onClick={selected} title={name}>
            {section.title === "Tags" ? <WorkbenchIcon name="link" size={14} /> : <FileIcon name={name} folder size={16} />}<span>{name}</span><small>{count}</small>
          </Link></li>)}</ul>
          {!items.length && <p className="empty">{filter ? "No matches." : `No ${section.title.toLowerCase()} available.`}</p>}
        </details>
      })}
    </div>
  </StyledSidebar>
}

const StyledSidebar = styled.aside`
  height: 100%; min-height: 0; display: flex; flex-direction: column;
  background: ${({ theme }) => theme.colors.editor.bg2}; color: ${({ theme }) => theme.colors.editor.fg2}; font: 12px var(--font-ui, sans-serif);
  header { display: flex; align-items: center; padding: 8px 12px 8px 18px; min-height: 35px; }
  h2 { flex: 1; font-size: 11px; font-weight: 400; letter-spacing: 0.5px; margin: 0; }
  button { color: inherit; background: transparent; border: 0; padding: 4px; cursor: pointer; display: flex; }
  .content { flex: 1; min-height: 0; overflow-y: auto; scrollbar-width: thin; padding-bottom: 20px; }
  a { color: inherit; text-decoration: none; }
  a:hover, button:hover { background: ${({ theme }) => theme.colors.editor.bg3}; }
  a:focus-visible, button:focus-visible, summary:focus-visible { outline: 1px solid ${({ theme }) => theme.colors.editor.accent}; outline-offset: -1px; }
  .editors { padding: 4px 8px 10px; }
  .editors a { display: flex; align-items: flex-start; gap: 8px; padding: 9px 8px; }
  .editors small { display: block; font-size: 10px; color: ${({ theme }) => theme.colors.editor.fg3}; margin-top: 4px; line-height: 1.5; }
  .filter { display: flex; align-items: center; gap: 6px; margin: 0 12px 12px; padding: 5px 6px; background: ${({ theme }) => theme.colors.editor.bg3}; border: 1px solid ${({ theme }) => theme.colors.editor.line}; }
  .filter:focus-within { border-color: ${({ theme }) => theme.colors.editor.accent}; }
  input { width: 100%; min-width: 0; background: transparent; color: inherit; font: inherit; border: 0; outline: 0; }
  summary { display: flex; align-items: center; gap: 5px; padding: 5px 12px; font-weight: 600; cursor: pointer; background: ${({ theme }) => theme.colors.editor.bg3}; list-style: none; }
  summary::-webkit-details-marker { display: none; }
  details[open] > summary > svg { transform: rotate(90deg); }
  small { font-size: 10px; font-variant-numeric: tabular-nums; color: ${({ theme }) => theme.colors.editor.fg3}; }
  summary small, li small { margin-left: auto; }
  ul { list-style: none; margin: 0; padding: 4px 0 8px; }
  li a { display: flex; align-items: center; gap: 7px; padding: 4px 14px 4px 23px; min-height: 25px; }
  li a > span { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  li a > svg, li a > img { flex-shrink: 0; }
  .empty { font-size: 11px; color: ${({ theme }) => theme.colors.editor.fg3}; padding: 8px 20px; }
`
