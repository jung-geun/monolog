import { useState, useMemo } from "react"
import { useRouter } from "next/router"
import Link from "next/link"
import styled from "@emotion/styled"
import usePostsQuery from "src/hooks/usePostsQuery"
import { useRegisterChrome } from "src/layouts/RootLayout/EditorChrome/RouteChromeContext"
import { TPost } from "src/types"

type Facet = "all" | "title" | "body" | "tags"

const highlight = (text: string, q: string) => {
  if (!q) return <>{text}</>
  const idx = text.toLowerCase().indexOf(q.toLowerCase())
  if (idx === -1) return <>{text}</>
  return (
    <>
      {text.slice(0, idx)}
      <mark>{text.slice(idx, idx + q.length)}</mark>
      {text.slice(idx + q.length)}
    </>
  )
}

const matchPost = (post: TPost, q: string, facet: Facet): boolean => {
  if (!q) return true
  const lq = q.toLowerCase()
  if (facet === "title") return (post.title || "").toLowerCase().includes(lq)
  if (facet === "tags") return (post.tags || []).some((t) => t.toLowerCase().includes(lq))
  if (facet === "body") return (post.summary || "").toLowerCase().includes(lq)
  return (
    (post.title || "").toLowerCase().includes(lq) ||
    (post.summary || "").toLowerCase().includes(lq) ||
    (post.tags || []).some((t) => t.toLowerCase().includes(lq))
  )
}

const Search = () => {
  const router = useRouter()
  const [q, setQ] = useState((router.query.q as string) || "")
  const [facet, setFacet] = useState<Facet>("all")
  const posts = usePostsQuery()

  const hits = useMemo(
    () => posts.filter((p) => matchPost(p, q, facet)),
    [posts, q, facet]
  )

  const statusItems = useMemo(
    () => ["search", q ? `q="${q}"` : "ready", `${hits.length} hits`, "fuzzy"],
    [q, hits.length]
  )
  useRegisterChrome("search", statusItems)

  return (
    <StyledWrapper>
      <div className="scroll-area">
        <div className="search-header">
          <div className="search-box">
            <span className="search-icon">⌕</span>
            <input
              autoFocus
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Type to search posts, tags, categories…"
            />
            {q && <span className="hit-count">{hits.length} results</span>}
          </div>

          <div className="facets">
            <span className="facet-label">filter:</span>
            {(["all", "title", "body", "tags"] as Facet[]).map((f) => (
              <button
                key={f}
                onClick={() => setFacet(f)}
                className={`facet${facet === f ? " active" : ""}`}
              >
                {f}
              </button>
            ))}
          </div>
        </div>

        <div className="results">
          {!q && (
            <div className="empty-state">
              <span className="comment">{"// "}</span>start typing to search across all posts
            </div>
          )}
          {q && hits.length === 0 && (
            <div className="empty-state">
              <span className="fatal">fatal:</span> no matches for &quot;{q}&quot;
            </div>
          )}
          {hits.map((post, i) => {
            const category = post.category?.[0]
            const dateStr = post.date?.start_date || post.createdTime?.slice(0, 10) || ""
            return (
              <Link key={post.id} href={`/${post.slug}`} className="result-row">
                <div className="result-num">{i + 1}</div>
                <div className="result-body">
                  <div className="result-meta">
                    {category && <span className="cat">{category}</span>}
                    <span className="date">{dateStr}</span>
                  </div>
                  <div className="result-title">{highlight(post.title, q)}</div>
                  {post.summary && (
                    <div className="result-summary">{highlight(post.summary, q)}</div>
                  )}
                  {post.tags && (
                    <div className="result-tags">
                      {post.tags.map((t) => (
                        <span key={t} className={t.toLowerCase().includes(q.toLowerCase()) ? "tag-hit" : ""}>
                          #{t}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              </Link>
            )
          })}

          {hits.length > 0 && (
            <div className="keyboard-hints">
              <span><kbd>↑↓</kbd> navigate</span>
              <span><kbd>↵</kbd> open</span>
              <span><kbd>esc</kbd> close</span>
              <span className="tip">tip: try <code>tag:rust</code></span>
            </div>
          )}
        </div>
      </div>
    </StyledWrapper>
  )
}

export default Search

const StyledWrapper = styled.div`
  display: flex;
  flex-direction: column;
  flex: 1;
  min-height: 0;
  overflow: hidden;

  .scroll-area {
    flex: 1;
    overflow-y: auto;
    scrollbar-width: none;
    &::-webkit-scrollbar { display: none; }
  }

  .search-header {
    padding: 32px 48px 20px;
    border-bottom: 1px solid ${({ theme }) => theme.colors.editor.line};

    .search-box {
      display: flex;
      align-items: center;
      gap: 14px;
      padding: 14px 18px;
      border: 2px solid ${({ theme }) => theme.colors.editor.accent};
      background: ${({ theme }) => theme.colors.editor.bg2};

      .search-icon {
        color: ${({ theme }) => theme.colors.editor.accent};
        font-size: 18px;
      }

      input {
        flex: 1;
        border: none;
        outline: none;
        background: transparent;
        font-family: var(--font-mono, monospace);
        font-size: 18px;
        color: ${({ theme }) => theme.colors.editor.fg};
        &::placeholder { color: ${({ theme }) => theme.colors.editor.fg3}; }
      }

      .hit-count {
        font-family: var(--font-mono, monospace);
        font-size: 11px;
        color: ${({ theme }) => theme.colors.editor.fg3};
        white-space: nowrap;
      }
    }

    .facets {
      display: flex;
      gap: 10px;
      margin-top: 16px;
      font-family: var(--font-mono, monospace);
      font-size: 11px;
      align-items: center;

      .facet-label { color: ${({ theme }) => theme.colors.editor.fg3}; }

      .facet {
        padding: 2px 8px;
        border: 1px solid ${({ theme }) => theme.colors.editor.line};
        color: ${({ theme }) => theme.colors.editor.fg2};
        background: transparent;
        cursor: pointer;

        &.active {
          border-color: ${({ theme }) => theme.colors.editor.accent};
          color: ${({ theme }) => theme.colors.editor.accent};
          background: ${({ theme }) => theme.colors.editor.accentSoft};
        }
      }
    }
  }

  .results {
    padding: 24px 48px 60px;

    .empty-state {
      font-family: var(--font-mono, monospace);
      font-size: 14px;
      color: ${({ theme }) => theme.colors.editor.fg3};
      padding: 40px 0;
      .comment { color: ${({ theme }) => theme.colors.editor.fg3}; }
      .fatal { color: ${({ theme }) => theme.colors.editor.accent2}; }
    }
  }

  .result-row {
    display: grid;
    grid-template-columns: 28px 1fr;
    gap: 16px;
    padding: 18px 0;
    border-top: 1px solid ${({ theme }) => theme.colors.editor.line};
    text-decoration: none;
    color: inherit;
    &:hover .result-title { color: ${({ theme }) => theme.colors.editor.accent3}; }

    .result-num {
      font-family: var(--font-mono, monospace);
      font-size: 11px;
      color: ${({ theme }) => theme.colors.editor.fg3};
      text-align: right;
      padding-top: 3px;
    }

    .result-body {
      min-width: 0;

      .result-meta {
        display: flex;
        gap: 10px;
        margin-bottom: 4px;
        font-family: var(--font-mono, monospace);
        font-size: 11px;
        .cat { color: ${({ theme }) => theme.colors.editor.accent}; text-transform: uppercase; letter-spacing: 1px; }
        .date { color: ${({ theme }) => theme.colors.editor.fg3}; }
      }

      .result-title {
        font-family: var(--font-mono, monospace);
        font-size: 20px;
        font-weight: 500;
        line-height: 1.25;
        color: ${({ theme }) => theme.colors.editor.fg};
        margin-bottom: 4px;
        transition: color 0.15s;
        mark {
          background: ${({ theme }) => theme.colors.editor.accent};
          color: #fff;
          padding: 0 2px;
        }
      }

      .result-summary {
        font-family: var(--font-mono, monospace);
        font-size: 12px;
        color: ${({ theme }) => theme.colors.editor.fg2};
        line-height: 1.6;
        margin-bottom: 4px;
        mark {
          background: ${({ theme }) => theme.colors.editor.accentSoft};
          color: ${({ theme }) => theme.colors.editor.accent};
          padding: 0 2px;
        }
      }

      .result-tags {
        display: flex;
        flex-wrap: wrap;
        gap: 6px;
        font-family: var(--font-mono, monospace);
        font-size: 11px;
        color: ${({ theme }) => theme.colors.editor.fg3};
        .tag-hit {
          background: ${({ theme }) => theme.colors.editor.accentSoft};
          color: ${({ theme }) => theme.colors.editor.accent};
          padding: 0 3px;
        }
      }
    }
  }

  .keyboard-hints {
    margin-top: 28px;
    padding: 12px 16px;
    background: ${({ theme }) => theme.colors.editor.bg2};
    border: 1px solid ${({ theme }) => theme.colors.editor.line};
    font-family: var(--font-mono, monospace);
    font-size: 11px;
    color: ${({ theme }) => theme.colors.editor.fg3};
    display: flex;
    gap: 18px;
    flex-wrap: wrap;

    kbd {
      padding: 1px 6px;
      border: 1px solid ${({ theme }) => theme.colors.editor.line2};
      background: ${({ theme }) => theme.colors.editor.bg};
      border-radius: 3px;
    }

    .tip { margin-left: auto; code { color: ${({ theme }) => theme.colors.editor.accent}; } }
  }

  @media (max-width: ${({ theme }) => theme.variables.breakpoint}px) {
    .search-header { padding: 20px 20px 16px; }
    .results { padding: 16px 20px 40px; }
    .result-row { grid-template-columns: 1fr; }
    .result-num { display: none; }
  }
`
