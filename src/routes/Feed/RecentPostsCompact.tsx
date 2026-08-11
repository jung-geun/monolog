import Link from "next/link"
import Image from "next/image"
import usePostsQuery from "src/hooks/usePostsQuery"

const getCategoryStyle = (cat: string) => {
  const normalized = cat.trim().toLowerCase()
  if (normalized.includes("doc")) {
    return {
      cardBorder: "hover:border-signal/45",
      stripHover: "group-hover:bg-signal",
      badgeBgText: "bg-signal-50 text-signal-900 dark:text-signal-200",
      titleHover: "group-hover:text-signal",
      arrowHover: "group-hover:text-signal",
    }
  }
  if (normalized.includes("computer") || normalized === "cs") {
    return {
      cardBorder: "hover:border-cs/45",
      stripHover: "group-hover:bg-cs",
      badgeBgText: "bg-cs-50 text-cs-900 dark:text-cs-200",
      titleHover: "group-hover:text-cs",
      arrowHover: "group-hover:text-cs",
    }
  }
  if (normalized.includes("paper") || normalized.includes("논문")) {
    return {
      cardBorder: "hover:border-paper/45",
      stripHover: "group-hover:bg-paper",
      badgeBgText: "bg-paper-50 text-paper-900 dark:text-paper-200",
      titleHover: "group-hover:text-paper",
      arrowHover: "group-hover:text-paper",
    }
  }
  if (normalized.includes("research")) {
    return {
      cardBorder: "hover:border-research/45",
      stripHover: "group-hover:bg-research",
      badgeBgText: "bg-research-50 text-research-900 dark:text-research-200",
      titleHover: "group-hover:text-research",
      arrowHover: "group-hover:text-research",
    }
  }
  return {
    cardBorder: "hover:border-signal/45",
    stripHover: "group-hover:bg-signal",
    badgeBgText: "bg-signal-50 text-signal-900 dark:text-signal-200",
    titleHover: "group-hover:text-signal",
    arrowHover: "group-hover:text-signal",
  }
}

const RecentPostsCompact = () => {
  const posts = usePostsQuery()
  const recent = posts.slice(0, 15)
  const rest = posts.length - 15

  if (!recent.length) return null

  return (
    <div className="mb-10">
      <div className="flex items-baseline justify-between mb-3">
        <h2 className="font-sans text-base font-semibold text-strong">Recent Posts</h2>
        <span className="font-mono text-xs text-mute">{posts.length} entries</span>
      </div>
      <div className="space-y-3">
        {recent.map((post) => {
          const category = post.category?.[0] ?? ""
          const style = getCategoryStyle(category)
          const dateOnly = (post.date?.start_date || post.createdTime || "").slice(0, 10)
          const tags = post.tags?.slice(0, 3).map((t) => `#${t}`).join(" · ") ?? ""

          return (
            <Link
              key={post.id}
              href={`/${post.slug}`}
              className={`group block rounded-[12px] border border-hairline bg-card overflow-hidden transition-colors ${style.cardBorder} hover:bg-card/85`}
            >
              <div className={`grid ${post.thumbnail ? "grid-cols-[6px_1fr_auto]" : "grid-cols-[6px_1fr]"}`}>
                <div className={`bg-hairline ${style.stripHover} transition-colors`} />
                <div className="p-4 min-w-0">
                  <div className="flex flex-wrap items-center gap-x-2 gap-y-1 mb-1.5">
                    {category && (
                      <span className={`font-mono text-[10px] font-medium px-2 py-0.5 rounded-md ${style.badgeBgText}`}>
                        {category.toUpperCase()}
                      </span>
                    )}
                    {tags && (
                      <span className="font-mono text-xs text-mute">{tags}</span>
                    )}
                  </div>
                  <h3 className={`font-sans text-base font-semibold text-strong leading-snug line-clamp-2 mb-1 ${style.titleHover} transition-colors`}>
                    {post.title}
                  </h3>
                  {post.summary && (
                    <p className="font-sans text-xs sm:text-sm text-soft leading-relaxed line-clamp-2 mb-2">
                      {post.summary}
                    </p>
                  )}
                  <div className="flex items-center justify-between">
                    <p className="font-mono text-xs text-mute">{dateOnly}</p>
                    <span className={`font-mono text-xs text-mute transition-colors ${style.arrowHover}`}>
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
        <p className="mt-4 text-center">
          <Link
            href="/search"
            className="font-mono text-xs text-mute hover:text-signal transition-colors"
          >
            View {rest} more entries →
          </Link>
        </p>
      )}
    </div>
  )
}

export default RecentPostsCompact
