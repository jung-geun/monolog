import { useEffect, useMemo, useState } from "react"
import Link from "next/link"
import styled from "@emotion/styled"
import type { ExtendedRecordMap } from "notion-types"
import { uuidToId } from "notion-utils"
import { getNotionRichTextPlainText } from "src/libs/utils/notion/richText"
import usePostsQuery from "src/hooks/usePostsQuery"
import type { TPost } from "src/types"
import { getArticleHeadings } from "../components/NotionRenderer/headings"
import { useWorkbench } from "src/layouts/RootLayout/EditorChrome/WorkbenchContext"
import { getReadingScrollRoot, observeReadingScroll, readingScrollOffset } from "./scrollRoot"

export type TocEntry = { id: string; text: string; level: number }
type Props = { recordMap: ExtendedRecordMap | null; post: TPost }

export const extractToc = (recordMap: ExtendedRecordMap | null): TocEntry[] => {
  return getArticleHeadings(recordMap).flatMap(({ block, level }) => {
    const text = getNotionRichTextPlainText(block.properties?.title)
    return text ? [{ id: uuidToId(block.id), text, level: level - 1 }] : []
  })
}

const RightRail = ({ recordMap, post }: Props) => {
  const [activeId, setActiveId] = useState("")
  const allPosts = usePostsQuery()
  const { isSecondaryOpen, readingMode, documentMode, scrollToHeading } = useWorkbench()
  const toc = useMemo(() => extractToc(recordMap), [recordMap])
  const seriesName = post.series?.[0]
  const seriesEntries = useMemo(() => seriesName ? allPosts.filter(entry => entry.series?.includes(seriesName)).sort((a, b) => new Date(a.date?.start_date || a.createdTime || 0).getTime() - new Date(b.date?.start_date || b.createdTime || 0).getTime()) : [], [allPosts, seriesName])

  useEffect(() => observeReadingScroll(() => {
    if (!toc.length) return
    const root = getReadingScrollRoot()
    const top = readingScrollOffset(root) + 90
    const sourceHeadings = root instanceof HTMLElement && root.matches(".document-source")
      ? Array.from(root.querySelectorAll<HTMLElement>("[data-source-heading]")) : null
    let active = toc[0].id
    for (const entry of toc) {
      const element = sourceHeadings ? sourceHeadings.find(heading => heading.dataset.sourceHeading === entry.id) : document.getElementById(entry.id)
      if (element && element.getBoundingClientRect().top <= top) active = entry.id
    }
    setActiveId(active)
  }), [toc, documentMode])

  if (!isSecondaryOpen || readingMode) return null
  return <Rail className="document-rail" aria-label="Document outline and series">
    <details open className="section">
      <summary>Outline <span>{toc.length}</span></summary>
      {toc.length ? toc.map(entry => <a key={entry.id} href={`#${entry.id}`} className={`toc-item level-${entry.level}${activeId === entry.id ? " active" : ""}`} aria-current={activeId === entry.id ? "location" : undefined} onClick={event => { event.preventDefault(); scrollToHeading(entry.id) }}>{entry.text}</a>) : <p className="empty">No section headings.</p>}
    </details>
    {seriesEntries.length > 0 && <details open className="section"><summary>Series <span>{seriesEntries.length}</span></summary><Link href={`/series/${encodeURIComponent(seriesName!)}`} className="series-title">{seriesName}</Link>{seriesEntries.map((entry, index) => <Link href={`/${entry.slug}`} key={entry.slug} className={`series-entry${entry.slug === post.slug ? " current" : ""}`} aria-current={entry.slug === post.slug ? "page" : undefined}><span>{index + 1}.</span>{entry.title}</Link>)}</details>}
  </Rail>
}

export default RightRail
const Rail = styled.aside`
  min-width: 0;
  min-height: 0;
  align-self: stretch;
  overflow: auto;
  overscroll-behavior: contain;
  border-left: 1px solid ${({ theme }) => theme.colors.editor.line};
  background: ${({ theme }) => theme.colors.editor.bg2};
  padding: 8px 0 24px;
  font-family: var(--font-sans, system-ui, sans-serif);
  font-size: 12px;
  .section { padding-bottom: 12px; }
  summary { cursor: pointer; padding: 7px 12px; font-size: 11px; font-weight: 600; color: ${({ theme }) => theme.colors.editor.fg2}; }
  summary span { float: right; color: ${({ theme }) => theme.colors.editor.fg3}; font-weight: 400; }
  a { color: ${({ theme }) => theme.colors.editor.fg2}; text-decoration: none; }
  .toc-item { display: block; padding: 5px 12px; border-left: 2px solid transparent; line-height: 1.45; overflow-wrap: anywhere; }
  .toc-item.level-2 { padding-left: 22px; }
  .toc-item.level-3 { padding-left: 32px; }
  .toc-item.level-4 { padding-left: 42px; }
  .toc-item.active { color: ${({ theme }) => theme.colors.editor.fg}; border-color: ${({ theme }) => theme.colors.editor.accent}; background: ${({ theme }) => theme.colors.editor.line}; }
  .series-title { display: block; margin: 4px 14px 8px; color: ${({ theme }) => theme.colors.editor.accent}; }
  .series-entry { display: flex; gap: 6px; padding: 5px 14px; line-height: 1.5; }
  .series-entry span { color: ${({ theme }) => theme.colors.editor.fg3}; font-variant-numeric: tabular-nums; }
  .series-entry.current { color: ${({ theme }) => theme.colors.editor.fg}; background: ${({ theme }) => theme.colors.editor.line}; }
  a:hover { background: ${({ theme }) => theme.colors.editor.line}; }
  a:focus-visible, summary:focus-visible { outline: 2px solid ${({ theme }) => theme.colors.editor.accent}; outline-offset: -2px; }
  .empty { padding: 4px 14px; color: ${({ theme }) => theme.colors.editor.fg3}; }
  scrollbar-gutter: stable;
`
