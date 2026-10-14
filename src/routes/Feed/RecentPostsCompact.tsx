import Link from "next/link"
import Image from "next/image"
import FileIcon from "src/components/FileIcon"
import WorkbenchIcon from "src/components/WorkbenchIcon"
import usePostsQuery from "src/hooks/usePostsQuery"

const RecentPostsCompact = () => {
  const posts = usePostsQuery()
  const recent = posts.slice(0, 10)
  return <section className="recent-section" aria-labelledby="recent-posts-heading">
    <div className="section-heading"><h2 id="recent-posts-heading">Recent</h2><Link href="/search">All {posts.length} entries <WorkbenchIcon name="arrow-right" size={14} /></Link></div>
    <ul className="entry-list">{recent.map(post => <li key={post.id}>
      <Link href={`/${post.slug}`} prefetch={false} className="entry-row">
        <span className="entry-thumbnail" aria-hidden="true">
          {post.thumbnail ? <Image src={post.thumbnail} alt="" fill sizes="(max-width: 960px) 88px, 112px" /> : <FileIcon name={`${post.slug}.md`} size={28} />}
        </span>
        <span className="entry-text">
          <span className="entry-title">{post.title}</span>
          <span className="entry-summary">{post.summary || post.category?.join(" / ") || post.slug}</span>
          <time>{(post.date?.start_date || post.createdTime || "").slice(0, 10)}</time>
        </span>
      </Link>
    </li>)}</ul>
    {!recent.length && <p className="empty">No publications available.</p>}
  </section>
}

export default RecentPostsCompact
