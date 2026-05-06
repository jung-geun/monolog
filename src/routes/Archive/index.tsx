import { useMemo } from "react"
import Link from "next/link"
import Image from "next/image"
import styled from "@emotion/styled"
import usePostsQuery from "src/hooks/usePostsQuery"
import { useCategoriesQuery } from "src/hooks/useCategoriesQuery"
import { useRegisterChrome } from "src/layouts/RootLayout/EditorChrome/RouteChromeContext"
import { DEFAULT_CATEGORY } from "src/constants"

const CAT_RAIL: Record<string, string> = {
  docs:     "bg-signal",
  cs:       "bg-cs",
  paper:    "bg-paper",
  research: "bg-research",
}

const CAT_BADGE: Record<string, { bg: string; text: string }> = {
  docs:     { bg: "bg-signal-50",   text: "text-signal-900" },
  cs:       { bg: "bg-cs-50",       text: "text-cs-900" },
  paper:    { bg: "bg-paper-50",    text: "text-paper-900" },
  research: { bg: "bg-research-50", text: "text-research-900" },
}

const DEFAULT_RAIL  = "bg-hairline"
const DEFAULT_BADGE = { bg: "bg-elevated", text: "text-soft" }

function toCatKey(cat: string): string {
  const s = cat.toLowerCase()
  if (s.includes("doc")) return "docs"
  if (s.includes("computer") || s === "cs") return "cs"
  if (s.includes("paper") || s.includes("논문")) return "paper"
  if (s.includes("research")) return "research"
  return s
}

type Props = {
  categoryName: string
}

const Archive = ({ categoryName }: Props) => {
  const allPosts = usePostsQuery()
  const categories = useCategoriesQuery()

  const posts = allPosts.filter(
    (p) => p.category && p.category.includes(categoryName)
  )

  const filename = `categories/${categoryName}.md`
  const statusItems = useMemo(
    () => ["main", `category: ${categoryName}`, `${posts.length} entries`, "Markdown"],
    [categoryName, posts.length]
  )
  useRegisterChrome(filename, statusItems)

  const catNames = Object.keys(categories).filter((n) => n !== DEFAULT_CATEGORY)
  const catKey = toCatKey(categoryName)
  const rail  = CAT_RAIL[catKey]  ?? DEFAULT_RAIL
  const badge = CAT_BADGE[catKey] ?? DEFAULT_BADGE

  return (
    <StyledWrapper>
      <div className="scroll-area">
        <div className="body">
          {/* YAML frontmatter */}
          <div className="font-mono text-[13px] space-y-0.5 mb-6">
            <p className="text-mute">---</p>
            <p><span className="text-signal-200">view</span><span className="text-mute">: </span><span className="text-zinc-300">category</span></p>
            <p><span className="text-signal-200">filter</span><span className="text-mute">: </span><span className="text-zinc-300">{categoryName}</span></p>
            <p><span className="text-signal-200">count</span><span className="text-mute">: </span><span className="text-zinc-300">{posts.length}</span></p>
            <p className="text-mute">---</p>
          </div>

          <h1 className="category-title">#{categoryName}</h1>
          <p className="sub">
            <span className="comment">{"// "}</span>
            {posts.length} entries in this category.
          </p>

          <div className="cat-nav">
            {catNames.map((name) => (
              <Link
                key={name}
                href={`/categories/${name}`}
                className={`cat-chip${name === categoryName ? " active" : ""}`}
              >
                {name} <span className="count">{categories[name]}</span>
              </Link>
            ))}
          </div>

          {/* Compact post list */}
          <div className="space-y-1.5">
            {posts.map((post) => {
              const dateOnly = (post.date?.start_date || post.createdTime || "").slice(0, 10)
              const tags = post.tags?.slice(0, 3).map((t) => `#${t}`).join(" · ") ?? ""
              return (
                <Link
                  key={post.id}
                  href={`/${post.slug}`}
                  className="group block rounded-md border border-hairline bg-card/60 overflow-hidden transition-colors hover:border-signal/45 hover:bg-card/85"
                >
                  <div className={`grid ${post.thumbnail ? "grid-cols-[6px_1fr_auto]" : "grid-cols-[6px_1fr]"}`}>
                    <div className={rail} />
                    <div className="p-3.5 min-w-0">
                      <div className="flex flex-wrap items-center gap-x-2 gap-y-1 mb-1.5">
                        <span className={`font-mono text-[10px] font-medium px-2 py-0.5 rounded ${badge.bg} ${badge.text}`}>
                          {categoryName.toUpperCase()}
                        </span>
                        {tags && (
                          <span className="font-mono text-[10px] text-mute">{tags}</span>
                        )}
                      </div>
                      <h3 className="text-[14px] font-medium text-zinc-50 leading-snug line-clamp-2 mb-1">
                        {post.title}
                      </h3>
                      {post.summary && (
                        <p className="text-[12px] text-soft leading-relaxed line-clamp-2 mb-1.5">
                          {post.summary}
                        </p>
                      )}
                      <div className="flex items-center justify-between">
                        <p className="font-mono text-[10px] text-mute">{dateOnly}</p>
                        <span className="font-mono text-xs text-mute transition-colors group-hover:text-signal-200">
                          →
                        </span>
                      </div>
                    </div>
                    {post.thumbnail && (
                      <div className="relative w-[110px] sm:w-[130px] shrink-0 overflow-hidden">
                        <Image
                          src={post.thumbnail}
                          alt=""
                          fill
                          sizes="130px"
                          className="object-cover"
                        />
                      </div>
                    )}
                  </div>
                </Link>
              )
            })}
          </div>
        </div>
      </div>
    </StyledWrapper>
  )
}

export default Archive

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

  .body {
    padding: 36px 56px;
    max-width: 900px;

    @media (max-width: ${({ theme }) => theme.variables.breakpoint}px) {
      padding: 20px 20px;
    }
  }

  .category-title {
    font-family: var(--font-mono, monospace);
    font-size: clamp(28px, 4vw, 48px);
    font-weight: 500;
    margin: 0 0 6px;
    color: ${({ theme }) => theme.colors.editor.fg};
    line-height: 1.0;

    &::before {
      content: "# ";
      color: ${({ theme }) => theme.colors.editor.accent};
      font-weight: 400;
    }
  }

  .sub {
    font-family: var(--font-mono, monospace);
    font-size: 13px;
    color: ${({ theme }) => theme.colors.editor.fg2};
    line-height: 1.7;
    margin: 8px 0 24px;

    .comment { color: ${({ theme }) => theme.colors.editor.fg3}; }
  }

  .cat-nav {
    display: flex;
    gap: 6px;
    flex-wrap: wrap;
    margin-bottom: 20px;
    padding-bottom: 18px;
    border-bottom: 1px solid ${({ theme }) => theme.colors.editor.line};

    .cat-chip {
      font-family: var(--font-mono, monospace);
      font-size: 11px;
      padding: 4px 10px;
      background: ${({ theme }) => theme.colors.editor.bg2};
      color: ${({ theme }) => theme.colors.editor.fg2};
      border: 1px solid ${({ theme }) => theme.colors.editor.line};
      text-decoration: none;

      .count { color: ${({ theme }) => theme.colors.editor.fg3}; }

      &.active {
        background: ${({ theme }) => theme.colors.editor.accent};
        color: #fff;
        border-color: ${({ theme }) => theme.colors.editor.accent};
        .count { color: rgba(255,255,255,0.8); }
      }

      &:hover:not(.active) {
        border-color: ${({ theme }) => theme.colors.editor.accent};
        color: ${({ theme }) => theme.colors.editor.accent};
      }
    }
  }
`
