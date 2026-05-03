import Link from "next/link"
import styled from "@emotion/styled"
import { TPost, TPosts } from "src/types"

type Props = {
  post: TPost
  allPosts: TPosts
}

const SeriesNav = ({ post, allPosts }: Props) => {
  const seriesName = post.series?.[0]
  if (!seriesName) return null

  // Prev/Next는 시간 순(오래된 → 최신) — 읽기 순서 의미
  const seriesPosts = allPosts
    .filter((p) => p.series?.includes(seriesName))
    .sort((a, b) => {
      const da = new Date(a.date?.start_date || a.createdTime || 0).getTime()
      const db = new Date(b.date?.start_date || b.createdTime || 0).getTime()
      return da - db
    })

  if (seriesPosts.length <= 1) return null

  const currentIdx = seriesPosts.findIndex((p) => p.slug === post.slug)
  const prev = currentIdx > 0 ? seriesPosts[currentIdx - 1] : null
  const next = currentIdx < seriesPosts.length - 1 ? seriesPosts[currentIdx + 1] : null

  if (!prev && !next) return null

  return (
    <StyledWrapper>
      <div className="series-label">
        <span className="icon">§</span>
        <Link href={`/series/${seriesName}`} className="series-name">{seriesName}</Link>
        <span className="pos">
          {currentIdx + 1} / {seriesPosts.length}
        </span>
      </div>
      <div className="nav-grid">
        <div className="nav-cell prev">
          {prev && (
            <Link href={`/${prev.slug}`} className="nav-link">
              <span className="nav-direction">← 이전</span>
              <span className="nav-title">{prev.title}</span>
            </Link>
          )}
        </div>
        <div className="nav-cell next">
          {next && (
            <Link href={`/${next.slug}`} className="nav-link">
              <span className="nav-direction">다음 →</span>
              <span className="nav-title">{next.title}</span>
            </Link>
          )}
        </div>
      </div>
    </StyledWrapper>
  )
}

export default SeriesNav

const StyledWrapper = styled.nav`
  margin: 40px 0 0;
  border-top: 1px solid ${({ theme }) => theme.colors.editor.line};
  padding-top: 20px;

  .series-label {
    display: flex;
    align-items: center;
    gap: 8px;
    font-family: var(--font-mono, monospace);
    font-size: 11px;
    color: ${({ theme }) => theme.colors.editor.fg3};
    margin-bottom: 12px;

    .icon { color: ${({ theme }) => theme.colors.editor.accent}; }

    .series-name {
      color: ${({ theme }) => theme.colors.editor.accent};
      text-decoration: none;
      font-weight: 500;
      &:hover { opacity: 0.8; }
    }

    .pos { margin-left: auto; }
  }

  .nav-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 12px;

    @media (max-width: ${({ theme }) => theme.variables.breakpoint}px) {
      grid-template-columns: 1fr;
    }
  }

  .nav-cell {
    min-width: 0;

    &.next { text-align: right; }
  }

  .nav-link {
    display: flex;
    flex-direction: column;
    gap: 4px;
    padding: 14px 16px;
    border: 1px solid ${({ theme }) => theme.colors.editor.line};
    background: ${({ theme }) => theme.colors.editor.bg2};
    text-decoration: none;
    color: inherit;
    transition: border-color 0.15s;
    height: 100%;

    &:hover {
      border-color: ${({ theme }) => theme.colors.editor.accent};
    }

    .nav-direction {
      font-family: var(--font-mono, monospace);
      font-size: 10px;
      color: ${({ theme }) => theme.colors.editor.fg3};
      letter-spacing: 0.5px;
    }

    .nav-title {
      font-family: var(--font-mono, monospace);
      font-size: 14px;
      color: ${({ theme }) => theme.colors.editor.fg};
      line-height: 1.4;
      display: -webkit-box;
      -webkit-line-clamp: 2;
      -webkit-box-orient: vertical;
      overflow: hidden;
    }
  }

  .nav-cell.next .nav-link {
    align-items: flex-end;
  }
`
