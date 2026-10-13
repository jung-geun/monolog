import Link from "next/link"
import FileIcon from "src/components/FileIcon"
import { useSeriesQuery } from "src/hooks/useSeriesQuery"

const FeaturedSeriesGrid = () => {
  const series = useSeriesQuery()
  const entries = Object.entries(series).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], "ko"))
  return <section className="series-section" aria-labelledby="featured-series-heading">
    <div className="section-heading"><h2 id="featured-series-heading">Series</h2><Link href="/series">All series</Link></div>
    <ul className="entry-list">{entries.map(([name, count]) => <li key={name}>
      <Link href={`/series/${encodeURIComponent(name)}`} className="entry-row"><FileIcon name={name} folder size={18} /><span className="entry-text entry-title">{name}</span><span className="entry-count">{count} entries</span></Link>
    </li>)}</ul>
    {!entries.length && <p className="empty">No series published yet.</p>}
  </section>
}

export default FeaturedSeriesGrid
