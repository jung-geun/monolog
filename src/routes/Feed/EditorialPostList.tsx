import Link from "next/link"
import Image from "next/image"
import styled from "@emotion/styled"
import usePostsQuery from "src/hooks/usePostsQuery"

const EditorialPostList = () => {
  const posts = usePostsQuery()

  if (!posts.length) return (
    <StyledWrapper>
      <div className="empty">no entries yet.</div>
    </StyledWrapper>
  )

  return (
    <StyledWrapper>
      <div className="section-header">
        <h2>Latest entries.</h2>
        <span className="meta">
          <span className="arrow">›</span> sorted by date · {posts.length} entries
        </span>
      </div>

      <div className="list">
        {posts.map((post) => {
          const category = post.category?.[0]
          const dateOnly = (post.date?.start_date || post.createdTime || "").slice(0, 10)
          const year = dateOnly.slice(0, 4)
          const monthDay = dateOnly.slice(5).replace("-", "·")

          return (
            <Link key={post.id} href={`/${post.slug}`} className="post-row">
              <div className="date-col">
                <div className="year">{year}</div>
                <div className="month-day">{monthDay}</div>
              </div>
              <div className="meta-col">
                <div className="meta-row">
                  {category && (
                    <span className="category">{category}</span>
                  )}
                  {post.tags && post.tags.length > 0 && (
                    <span className="tags">
                      {post.tags.slice(0, 4).map((t) => `#${t}`).join(" ")}
                    </span>
                  )}
                </div>
                <h3 className="title">{post.title}</h3>
                {post.summary && (
                  <p className="summary">{post.summary}</p>
                )}
              </div>
              <div className="thumb-col">
                {post.thumbnail ? (
                  <div className="thumb-img">
                    <Image
                      src={post.thumbnail}
                      alt=""
                      fill
                      sizes="100px"
                      style={{ objectFit: "cover" }}
                      unoptimized
                    />
                  </div>
                ) : (
                  <div className="thumb-placeholder" aria-hidden />
                )}
              </div>
            </Link>
          )
        })}
      </div>
    </StyledWrapper>
  )
}

export default EditorialPostList

const StyledWrapper = styled.div`
  .empty {
    font-family: var(--font-mono, monospace);
    color: ${({ theme }) => theme.colors.editor.fg3};
    font-size: 13px;
    padding: 40px 0;
  }

  .section-header {
    margin-bottom: 4px;

    h2 {
      font-family: var(--font-mono, monospace);
      font-size: 28px;
      font-weight: 500;
      color: ${({ theme }) => theme.colors.editor.fg};
      margin: 0 0 4px;

      &::before {
        content: "## ";
        color: ${({ theme }) => theme.colors.editor.accent};
        font-weight: 400;
      }
    }

    .meta {
      font-family: var(--font-mono, monospace);
      font-size: 12px;
      color: ${({ theme }) => theme.colors.editor.fg3};
      display: block;
      margin-bottom: 24px;

      .arrow { color: ${({ theme }) => theme.colors.editor.accent}; }
    }
  }

  .list {
    .post-row {
      display: grid;
      grid-template-columns: 92px 1fr 100px;
      gap: 24px;
      align-items: baseline;
      padding: 20px 0;
      border-top: 1px solid ${({ theme }) => theme.colors.editor.line};
      text-decoration: none;
      color: inherit;

      &:hover .title {
        color: ${({ theme }) => theme.colors.editor.accent3};
      }

      .date-col {
        font-family: var(--font-mono, monospace);
        font-size: 12px;
        color: ${({ theme }) => theme.colors.editor.fg3};

        .month-day {
          font-size: 13px;
          color: ${({ theme }) => theme.colors.editor.fg2};
        }
      }

      .meta-col {
        min-width: 0;

        .meta-row {
          display: flex;
          align-items: center;
          gap: 10px;
          margin-bottom: 6px;
          flex-wrap: wrap;
        }

        .category {
          font-family: var(--font-mono, monospace);
          font-size: 10px;
          padding: 1px 8px;
          background: ${({ theme }) => theme.colors.editor.bg2};
          color: ${({ theme }) => theme.colors.editor.accent};
          border: 1px solid ${({ theme }) => theme.colors.editor.line};
          text-transform: uppercase;
          letter-spacing: 1px;
        }

        .tags {
          font-family: var(--font-mono, monospace);
          font-size: 11px;
          color: ${({ theme }) => theme.colors.editor.fg3};
        }

        .title {
          font-family: var(--font-mono, monospace);
          font-size: 20px;
          font-weight: 500;
          margin: 0 0 6px;
          color: ${({ theme }) => theme.colors.editor.fg};
          line-height: 1.25;
          letter-spacing: -0.01em;
          transition: color 0.15s;
        }

        .summary {
          font-family: var(--font-mono, monospace);
          font-size: 13px;
          line-height: 1.65;
          color: ${({ theme }) => theme.colors.editor.fg2};
          margin: 0;
          max-width: 620px;
          overflow: hidden;
          display: -webkit-box;
          -webkit-line-clamp: 2;
          -webkit-box-orient: vertical;
        }
      }

      .thumb-col {
        .thumb-img,
        .thumb-placeholder {
          position: relative;
          width: 100px;
          height: 72px;
          border: 1px solid ${({ theme }) => theme.colors.editor.line};
          background: ${({ theme }) => theme.colors.editor.bg2};
          overflow: hidden;
        }
      }
    }
  }

  @media (max-width: ${({ theme }) => theme.variables.breakpoint}px) {
    .list .post-row {
      grid-template-columns: 1fr;
      gap: 8px;

      .date-col { display: flex; gap: 6px; align-items: center; }
      .thumb-col { display: none; }
    }
  }
`
