import type { GetServerSideProps } from "next"
import { getPosts } from "src/apis/notion-client/getPosts"
import { filterPosts } from "src/libs/utils/notion/filterPosts"
import { absoluteUrl, escapeXml, modifiedDate, postUrl, publicDetails } from "src/libs/seo"
import { errorLog } from "src/libs/utils/logger"

const latestDate = (current: string | undefined, candidate: string | undefined): string | undefined =>
  candidate && (!current || candidate > current) ? candidate : current

export const getServerSideProps: GetServerSideProps = async ({ req, res }) => {
  res.setHeader("Cache-Control", "no-store")
  try {
    const posts = await getPosts()
    const details = publicDetails(posts)
    const feed = filterPosts(posts)
    const entries = new Map<string, string | undefined>()
    const categories = new Map<string, string | undefined>()
    const series = new Map<string, string | undefined>()
    let homeModified: string | undefined
    let seriesModified: string | undefined
    for (const post of feed) {
      const modified = modifiedDate(post)
      homeModified = latestDate(homeModified, modified)
      for (const name of post.category ?? []) {
        if (!name.trim()) continue
        categories.set(name, latestDate(categories.get(name), modified))
      }
      for (const name of post.series ?? []) {
        if (!name.trim()) continue
        series.set(name, latestDate(series.get(name), modified))
        seriesModified = latestDate(seriesModified, modified)
      }
    }
    entries.set(absoluteUrl("/"), homeModified)
    entries.set(absoluteUrl("/series"), seriesModified)
    for (const [name, modified] of categories) {
      entries.set(absoluteUrl(`/categories/${encodeURIComponent(name)}`), modified)
    }
    for (const [name, modified] of series) {
      entries.set(absoluteUrl(`/series/${encodeURIComponent(name)}`), modified)
    }
    for (const post of details) entries.set(postUrl(post.slug), modifiedDate(post))

    const urls = Array.from(entries, ([url, modified]) =>
      `  <url><loc>${escapeXml(url)}</loc>${modified ? `<lastmod>${modified}</lastmod>` : ""}</url>`
    ).join("\n")
    const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>`
    res.setHeader("Content-Type", "application/xml; charset=utf-8")
    res.end(req.method === "HEAD" ? undefined : xml)
  } catch (error) {
    errorLog("Error generating sitemap:", error)
    res.statusCode = 503
    res.setHeader("Content-Type", "text/plain; charset=utf-8")
    res.setHeader("Retry-After", "60")
    res.end(req.method === "HEAD" ? undefined : "Sitemap temporarily unavailable\n")
  }
  return { props: {} }
}

const Sitemap = () => null
export default Sitemap
