import Link from "next/link"
import Image from "next/image"
import usePostsQuery from "src/hooks/usePostsQuery"
import { getCategoryStyle } from "src/styles/categoryStyle"

const RecentPostsCompact = () => {
  const posts = usePostsQuery()
  const recent = posts.slice(0, 15)
  const rest = posts.length - 15

  if (!recent.length) return null

  return (
    <section className="mb-10" aria-labelledby="recent-posts-heading">
      <div className="flex items-baseline justify-between mb-3">
        <h2 id="recent-posts-heading" className="font-sans text-base font-semibold text-strong">Recent Posts</h2>
        <span className="font-mono text-xs text-mute">{posts.length} entries</span>
      </div>
      <div className="recent-posts-flow">
        {recent.map((post) => {
          const category = post.category?.[0] ?? ""
          const style = getCategoryStyle(category)
          const dateOnly = (post.date?.start_date || post.createdTime || "").slice(0, 10)
          const tags = post.tags?.slice(0, 3).map((t) => `#${t}`).join(" · ") ?? ""

          return (
            <article key={post.id} className="mb-3">
              <Link
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
                    <span className={`font-mono text-xs text-mute motion-safe:transition-[color,translate] duration-150 motion-safe:group-hover:translate-x-1 motion-safe:group-focus-visible:translate-x-1 ${style.arrowHover}`}>
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
            </article>
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
    </section>
  )
}

export default RecentPostsCompact
