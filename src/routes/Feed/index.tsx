import { useMemo } from "react"
import Link from "next/link"
import styled from "@emotion/styled"
import { useRegisterChrome } from "src/layouts/RootLayout/EditorChrome/RouteChromeContext"
import HomeHero from "./HomeHero"
import FeaturedSeriesGrid from "./FeaturedSeriesGrid"
import RecentPostsCompact from "./RecentPostsCompact"
import FileIcon from "src/components/FileIcon"
import WorkbenchIcon from "src/components/WorkbenchIcon"
import usePostsQuery from "src/hooks/usePostsQuery"
import { useTagsQuery } from "src/hooks/useTagsQuery"
import { useCategoriesQuery } from "src/hooks/useCategoriesQuery"
import { DEFAULT_CATEGORY } from "src/constants"

const Feed = () => {
  const posts = usePostsQuery()
  const tags = useTagsQuery()
  const categories = useCategoriesQuery()
  const statusItems = useMemo(() => ["Welcome", `${posts.length} publications`, "Read-only workspace"], [posts.length])
  useRegisterChrome("Welcome", statusItems, "readme")
  return <StyledWrapper>
    <HomeHero />
    <div className="welcome-columns"><RecentPostsCompact /><FeaturedSeriesGrid /></div>
    <section className="browse-section" aria-labelledby="browse-heading"><h2 id="browse-heading">Browse</h2>
      <div className="browse-columns">
        <nav aria-label="Categories"><h3>Categories</h3>{Object.entries(categories).filter(([name]) => name !== DEFAULT_CATEGORY).sort((a, b) => b[1] - a[1]).map(([name, count]) =>
          <Link key={name} href={`/categories/${encodeURIComponent(name)}`}><FileIcon name={name} folder size={16} /><span>{name}</span><small>{count}</small></Link>)}
        </nav>
        <nav aria-label="Tags"><h3>Tags</h3><div className="tags">{Object.entries(tags).sort((a, b) => b[1] - a[1]).map(([name, count]) =>
          <Link key={name} href={{ pathname: "/search", query: { q: `tag:${JSON.stringify(name)}` } }}><WorkbenchIcon name="link" size={13} /><span>{name}</span><small>{count}</small></Link>)}</div>
        </nav>
      </div>
    </section>
  </StyledWrapper>
}

export default Feed

const StyledWrapper = styled.main`
  flex: 1; width: 100%; min-width: 0; max-width: 1120px; padding: 28px 40px 48px; box-sizing: border-box;
  color: ${({ theme }) => theme.colors.editor.fg}; font: 13px var(--font-ui, sans-serif);
  h1 { font-size: 28px; line-height: 1.2; font-weight: 400; margin: 0 0 5px; letter-spacing: -0.5px; }
  h2 { font-size: 17px; font-weight: 400; margin: 0 0 12px; }
  h3 { font-size: 12px; font-weight: 500; color: ${({ theme }) => theme.colors.editor.fg3}; margin: 0 0 9px; }
  a { text-decoration: none; color: ${({ theme }) => theme.colors.editor.accent}; }
  button { cursor: pointer; font: inherit; }
  a:focus-visible, button:focus-visible { outline: 1px solid ${({ theme }) => theme.colors.editor.accent}; outline-offset: 2px; }
  .workspace-name { margin: 0 0 20px; font-size: 15px; color: ${({ theme }) => theme.colors.editor.fg3}; }
  .author-identity { display: flex; align-items: center; gap: 10px; }
  .author-identity img { border-radius: 4px; }
  .author-identity a { display: block; font-weight: 500; color: ${({ theme }) => theme.colors.editor.fg}; }
  .author-identity span { font-size: 11px; color: ${({ theme }) => theme.colors.editor.fg3}; }
  .author-bio { color: ${({ theme }) => theme.colors.editor.fg2}; margin: 10px 0 0; line-height: 1.6; }
  .start-section { margin: 28px 0; }
  .start-actions { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 4px 24px; }
  .start-actions > a, .start-actions > button { display: flex; gap: 9px; align-items: flex-start; padding: 8px 6px; background: transparent; border: 0; color: ${({ theme }) => theme.colors.editor.accent}; text-align: left; }
  .start-actions > a:hover, .start-actions > button:hover { background: ${({ theme }) => theme.colors.editor.bg3}; }
  .start-actions small { display: block; font-size: 11px; line-height: 1.5; margin-top: 3px; color: ${({ theme }) => theme.colors.editor.fg3}; }
  .welcome-columns { display: grid; grid-template-columns: minmax(0, 1.5fr) minmax(0, 1fr); gap: 32px; }
  .section-heading { display: flex; align-items: baseline; justify-content: space-between; gap: 10px; }
  .section-heading a { font-size: 11px; display: inline-flex; gap: 4px; align-items: center; white-space: nowrap; }
  .entry-list { list-style: none; margin: 0; padding: 0; }
  .entry-row { display: flex; align-items: flex-start; gap: 12px; padding: 12px 4px; color: ${({ theme }) => theme.colors.editor.fg2}; border-bottom: 1px solid ${({ theme }) => theme.colors.editor.line}; }
  .entry-row:hover { background: ${({ theme }) => theme.colors.editor.bg3}; }
  .entry-thumbnail { position: relative; display: flex; align-items: center; justify-content: center; width: 112px; aspect-ratio: 8 / 5; flex-shrink: 0; overflow: hidden; background: ${({ theme }) => theme.colors.editor.bg3}; border: 1px solid ${({ theme }) => theme.colors.editor.line}; }
  .entry-thumbnail img { object-fit: cover; }
  .entry-text { min-width: 0; flex: 1; }
  .entry-title { display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; line-height: 1.5; overflow-wrap: anywhere; color: ${({ theme }) => theme.colors.editor.fg}; }
  .entry-summary { display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; font-size: 11px; line-height: 1.6; color: ${({ theme }) => theme.colors.editor.fg3}; margin-top: 4px; overflow-wrap: anywhere; }
  .entry-text time { display: block; margin-top: 6px; }
  time, .entry-count { font-size: 10px; color: ${({ theme }) => theme.colors.editor.fg3}; font-variant-numeric: tabular-nums; white-space: nowrap; padding-top: 3px; }
  .empty { color: ${({ theme }) => theme.colors.editor.fg3}; font-size: 12px; }
  .browse-section { margin-top: 30px; padding-top: 22px; border-top: 1px solid ${({ theme }) => theme.colors.editor.line}; }
  .browse-columns { display: grid; grid-template-columns: minmax(120px, 1fr) minmax(0, 2fr); gap: 30px; }
  .browse-columns nav > a { display: flex; gap: 7px; align-items: center; padding: 5px 3px; }
  .browse-columns small { color: ${({ theme }) => theme.colors.editor.fg3}; font-size: 10px; font-variant-numeric: tabular-nums; }
  .browse-columns nav > a small { margin-left: auto; }
  .tags { display: flex; flex-wrap: wrap; gap: 6px 14px; }
  .tags a { display: inline-flex; gap: 5px; align-items: center; padding: 3px 0; font-size: 12px; }
  .tags a:hover, .browse-columns nav > a:hover { color: ${({ theme }) => theme.colors.editor.fg}; }
  @media (max-width: 1050px) { padding: 24px; .welcome-columns { grid-template-columns: minmax(0, 1fr); gap: 28px; } }
  @media (max-width: ${({ theme }) => theme.variables.breakpoint}px) { padding: 22px 18px 36px; .start-actions, .browse-columns { grid-template-columns: 1fr; gap: 10px; } .browse-columns { gap: 20px; } .entry-thumbnail { width: 88px; } .entry-row { gap: 10px; } }
`
