import Link from "next/link"
import Image from "next/image"
import usePostsQuery from "src/hooks/usePostsQuery"

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

const RecentPostsCompact = () => {
  const posts = usePostsQuery()
  const recent = posts.slice(0, 15)
  const rest = posts.length - 15

  if (!recent.length) return null

  return (
    <div className="mb-8">
      <p className="font-mono text-[13px] mb-2">
        <span className="text-signal">{"### "}</span>
        <span className="text-strong">latest</span>
        <span className="text-mute ml-2 italic text-[11px]">
          {"// sorted by date · "}{posts.length}{" entries"}
        </span>
      </p>
      <div className="space-y-1.5">
        {recent.map((post) => {
          const cat = toCatKey(post.category?.[0] ?? "")
          const rail  = CAT_RAIL[cat]  ?? DEFAULT_RAIL
          const badge = CAT_BADGE[cat] ?? DEFAULT_BADGE
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
                    {cat && (
                      <span className={`font-mono text-[10px] font-medium px-2 py-0.5 rounded ${badge.bg} ${badge.text}`}>
                        {cat.toUpperCase()}
                      </span>
                    )}
                    {tags && (
                      <span className="font-mono text-[10px] text-mute">{tags}</span>
                    )}
                  </div>
                  <h3 className="text-[14px] font-medium text-strong leading-snug line-clamp-2 mb-1">
                    {post.title}
                  </h3>
                  {post.summary && (
                    <p className="text-[12px] text-soft leading-relaxed line-clamp-2 mb-1.5">
                      {post.summary}
                    </p>
                  )}
                  <div className="flex items-center justify-between">
                    <p className="font-mono text-[10px] text-mute">{dateOnly}</p>
                    <span className="font-mono text-xs text-mute transition-colors group-hover:text-signal dark:group-hover:text-signal-200">
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
      {rest > 0 && (
        <p className="mt-3 text-center">
          <Link
            href="/search"
            className="font-mono text-[12px] text-mute italic hover:text-strong transition-colors"
          >
            {"// view "}{rest}{" more entries →"}
          </Link>
        </p>
      )}
    </div>
  )
}

export default RecentPostsCompact
