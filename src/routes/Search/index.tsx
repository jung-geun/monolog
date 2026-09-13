import { useState, useMemo } from "react"
import { useRouter } from "next/router"
import Link from "next/link"
import Image from "next/image"
import styled from "@emotion/styled"
import usePostsQuery from "src/hooks/usePostsQuery"
import { useRegisterChrome } from "src/layouts/RootLayout/EditorChrome/RouteChromeContext"
import { TPost } from "src/types"
import { getCategoryStyle } from "src/styles/categoryStyle"

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
          {hits.length > 0 && (
            <div className="results-grid">
              {hits.map((post) => {
                const category = post.category?.[0] ?? ""
                const style = getCategoryStyle(category)
                const dateOnly = (post.date?.start_date || post.createdTime || "").slice(0, 10)

                return (
                  <Link
                    key={post.id}
                    href={`/${post.slug}`}
                    className={`result-card group border-hairline ${style.cardBorder}`}
                  >
                    {post.thumbnail && (
                      <div className="result-thumbnail">
                        <Image
                          src={post.thumbnail}
                          alt=""
                          fill
                          sizes="(max-width: 960px) 100vw, 25vw"
                          className="object-cover"
                        />
                      </div>
                    )}

                    <div className="result-body">
                      <div className="result-header">
                        {category && (
                          <span className={`result-category ${style.badgeBgText}`}>
                            {category.toUpperCase()}
                          </span>
                        )}
                      </div>

                      <h3 className={`result-title text-strong ${style.titleHover}`}>
                        {highlight(post.title, q)}
                      </h3>

                      {post.summary && (
                        <p className="result-summary">{highlight(post.summary, q)}</p>
                      )}

                      {post.tags && (
                        <div className="result-tags">
                          {post.tags.map((t) => (
                            <span
                              key={t}
                              className={q && t.toLowerCase().includes(q.toLowerCase()) ? "tag tag-hit" : "tag"}
                            >
                              #{t}
                            </span>
                          ))}
                        </div>
                      )}

                      <div className="result-footer">
                        <span>{dateOnly}</span>
                        <span className={style.arrowHover}>→</span>
                      </div>
                    </div>
                  </Link>
                )
              })}
            </div>
          )}

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

  .results-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(260px, 1fr));
    gap: 18px;
  }

  .result-card {
    display: flex;
    flex-direction: column;
    min-width: 0;
    overflow: hidden;
    border-width: 1px;
    border-style: solid;
    border-radius: 12px;
    background: rgb(var(--c-card) / 1);
    color: inherit;
    text-decoration: none;
    transition: border-color 0.15s, background-color 0.15s;

    &:hover {
      background: rgb(var(--c-elevated) / 1);
    }
  }

  .result-thumbnail {
    position: relative;
    height: 150px;
    overflow: hidden;
    border-bottom: 1px solid rgb(var(--c-hairline) / 1);
    background: rgb(var(--c-sunken) / 1);
  }

  .result-body {
    display: flex;
    flex: 1;
    flex-direction: column;
    min-height: 210px;
    padding: 16px;
  }

  .result-header {
    min-height: 22px;
    margin-bottom: 8px;
  }

  .result-category {
    display: inline-flex;
    padding: 2px 8px;
    border-radius: 6px;
    font-family: var(--font-mono, monospace);
    font-size: 10px;
    font-weight: 600;
    letter-spacing: 0.05em;
  }

  .result-title {
    display: -webkit-box;
    overflow: hidden;
    margin: 0 0 8px;
    -webkit-box-orient: vertical;
    -webkit-line-clamp: 2;
    font-family: var(--font-sans, sans-serif);
    font-size: 16px;
    font-weight: 600;
    line-height: 1.35;
    transition: color 0.15s;

    mark {
      background: ${({ theme }) => theme.colors.editor.accent};
      color: #fff;
      padding: 0 2px;
    }
  }

  .result-summary {
    display: -webkit-box;
    overflow: hidden;
    margin: 0 0 12px;
    -webkit-box-orient: vertical;
    -webkit-line-clamp: 3;
    color: rgb(var(--c-soft) / 1);
    font-family: var(--font-sans, sans-serif);
    font-size: 13px;
    line-height: 1.55;

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
    margin-bottom: 14px;
  }

  .tag {
    border: 1px solid rgb(var(--c-hairline) / 1);
    border-radius: 999px;
    padding: 2px 7px;
    color: rgb(var(--c-mute) / 1);
    font-family: var(--font-mono, monospace);
    font-size: 10px;
  }

  .tag-hit {
    border-color: ${({ theme }) => theme.colors.editor.accent};
    background: ${({ theme }) => theme.colors.editor.accentSoft};
    color: ${({ theme }) => theme.colors.editor.accent};
  }

  .result-footer {
    display: flex;
    justify-content: space-between;
    margin-top: auto;
    color: rgb(var(--c-mute) / 1);
    font-family: var(--font-mono, monospace);
    font-size: 11px;
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
    .results-grid { grid-template-columns: 1fr; }
    .result-body { min-height: 0; }
  }
`
