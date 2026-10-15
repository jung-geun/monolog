import { useMemo } from "react"
import Link from "next/link"
import Image from "next/image"
import FileIcon from "src/components/FileIcon"
import { useSeriesQuery } from "src/hooks/useSeriesQuery"
import usePostsQuery from "src/hooks/usePostsQuery"
import type { TPost } from "src/types"

const FeaturedSeriesGrid = () => {
  const series = useSeriesQuery()
  const posts = usePostsQuery()
  const latestBySeriesName = useMemo(() => {
    const latest = new Map<string, TPost>()
    for (const post of posts) {
      for (const name of post.series ?? []) {
        if (!latest.has(name)) latest.set(name, post)
      }
    }
    return latest
  }, [posts])
  const entries = Object.entries(series).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], "ko"))
  return <section className="series-section" aria-labelledby="featured-series-heading">
    <div className="section-heading"><h2 id="featured-series-heading">Series</h2><Link href="/series">All series</Link></div>
    <ul className="entry-list">{entries.map(([name, count]) => {
      const latestPost = latestBySeriesName.get(name)
      return <li key={name}>
        <Link href={`/series/${encodeURIComponent(name)}`} className="entry-row">
          <span className="entry-thumbnail" aria-hidden="true">
            {latestPost?.thumbnail ? <Image src={latestPost.thumbnail} alt="" fill sizes="(max-width: 960px) 88px, 112px" /> : <FileIcon name={name} folder size={28} />}
          </span>
          <span className="entry-text"><span className="entry-title">{name}</span>{latestPost && <span className="entry-summary">{latestPost.title}</span>}</span>
          <span className="entry-count">{count} entries</span>
        </Link>
      </li>
    })}</ul>
    {!entries.length && <p className="empty">No series published yet.</p>}
  </section>
}

export default FeaturedSeriesGrid
