import Link from "next/link"
import { useRouter } from "next/router"
import styled from "@emotion/styled"
import usePostsQuery from "src/hooks/usePostsQuery"
import { useCategoriesQuery } from "src/hooks/useCategoriesQuery"
import { useSeriesQuery } from "src/hooks/useSeriesQuery"
import { CONFIG } from "site.config"
import { DEFAULT_CATEGORY } from "src/constants"

const FileTree = () => {
  const router = useRouter()
  const posts = usePostsQuery()
  const categories = useCategoriesQuery()
  const series = useSeriesQuery()
  const activeSlug = router.query.slug as string | undefined

  const recentPosts = posts.slice(0, 15)
  const categoryEntries = Object.entries(categories).filter(
    ([name]) => name !== DEFAULT_CATEGORY
  )

  return (
    <StyledWrapper>
      <div className="workspace-label">pieroot.log</div>

      <div className="section-header">▾ posts/</div>
      {recentPosts.map((p) => (
        <Link
          key={p.slug}
          href={`/${p.slug}`}
          className={`file-item${p.slug === activeSlug ? " active" : ""}`}
          title={p.title}
        >
          <span className="file-icon">◧</span>
          <span className="file-name">
            {p.slug.slice(0, 22)}.md
          </span>
        </Link>
      ))}

      <div className="section-header">▾ categories/</div>
      {categoryEntries.map(([name, count]) => (
        <Link
          key={name}
          href={`/categories/${name}`}
          className="file-item category"
        >
          <span className="cat-hash">#</span>
          <span className="cat-name">{name}</span>
          <span className="cat-count">{count}</span>
        </Link>
      ))}

      {Object.keys(series).length > 0 && (
        <>
          <div className="section-header">▾ series/</div>
          {Object.entries(series).map(([name, count]) => (
            <Link
              key={name}
              href={`/series/${name}`}
              className="file-item category"
            >
              <span className="cat-hash">§</span>
              <span className="cat-name">{name}</span>
              <span className="cat-count">{count}</span>
            </Link>
          ))}
        </>
      )}

      {CONFIG.projects.length > 0 && (
        <>
          <div className="section-header">▾ projects/</div>
          {CONFIG.projects.map((p) => (
            <a
              key={p.name}
              href={p.href}
              target="_blank"
              rel="noopener noreferrer"
              className="file-item"
              title={p.name}
            >
              <span className="file-icon">⇗</span>
              <span className="file-name">{p.name.slice(0, 22)}</span>
            </a>
          ))}
        </>
      )}

      <div className="section-header collapsed">▸ drafts/</div>
      <div className="section-header collapsed">▸ public/</div>
      <Link
        href="/"
        className={`file-item${router.pathname === "/" ? " active" : ""}`}
      >
        <span className="file-name">  README.md</span>
      </Link>
      <Link
        href="/about"
        className={`file-item${router.pathname === "/about" ? " active" : ""}`}
      >
        <span className="file-name">  about.md</span>
      </Link>
    </StyledWrapper>
  )
}

export default FileTree

const StyledWrapper = styled.nav`
  width: ${({ theme }) => theme.variables.fileTreeWidth}px;
  background: ${({ theme }) => theme.colors.editor.bg2};
  border-right: 1px solid ${({ theme }) => theme.colors.editor.line};
  font-family: var(--font-mono, monospace);
  font-size: 12px;
  color: ${({ theme }) => theme.colors.editor.fg2};
  overflow-y: auto;
  overflow-x: hidden;
  padding: 10px 0;
  flex-shrink: 0;

  scrollbar-width: none;
  &::-webkit-scrollbar { display: none; }

  .workspace-label {
    padding: 0 12px 8px;
    font-size: 10px;
    color: ${({ theme }) => theme.colors.editor.fg3};
    letter-spacing: 1.2px;
    text-transform: uppercase;
  }

  .section-header {
    padding: 2px 12px;
    color: ${({ theme }) => theme.colors.editor.fg3};
    cursor: default;
    margin-top: 6px;
    &.collapsed { margin-top: 2px; }
  }

  .file-item {
    display: flex;
    align-items: center;
    padding: 3px 12px 3px 26px;
    color: ${({ theme }) => theme.colors.editor.fg2};
    background: transparent;
    border-left: 2px solid transparent;
    margin-left: -2px;
    cursor: pointer;
    white-space: nowrap;
    overflow: hidden;
    text-decoration: none;
    gap: 6px;

    &:hover {
      background: ${({ theme }) => theme.colors.editor.bg3};
      color: ${({ theme }) => theme.colors.editor.fg};
    }

    &.active {
      background: ${({ theme }) => theme.colors.editor.bg3};
      color: ${({ theme }) => theme.colors.editor.fg};
      border-left-color: ${({ theme }) => theme.colors.editor.accent};
    }

    &.static {
      color: ${({ theme }) => theme.colors.editor.fg3};
      cursor: default;
      &:hover { background: transparent; color: ${({ theme }) => theme.colors.editor.fg3}; }
    }

    &.category {
      justify-content: space-between;
    }

    .file-icon {
      color: ${({ theme }) => theme.colors.editor.accent2};
      flex-shrink: 0;
    }
    .file-name {
      overflow: hidden;
      text-overflow: ellipsis;
    }
    .cat-hash { color: ${({ theme }) => theme.colors.editor.fg3}; flex-shrink: 0; }
    .cat-name { flex: 1; overflow: hidden; text-overflow: ellipsis; }
    .cat-count { color: ${({ theme }) => theme.colors.editor.fg3}; flex-shrink: 0; margin-left: 8px; }
  }

  @media (max-width: ${({ theme }) => theme.variables.breakpoint}px) {
    display: none;
  }
`
