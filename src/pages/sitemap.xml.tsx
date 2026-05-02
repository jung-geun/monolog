import type { GetServerSideProps } from "next"
import { getPosts } from "../apis/notion-client/getPosts"
import { CONFIG } from "site.config"
import type { TPost } from "../types"

export const getServerSideProps: GetServerSideProps = async ({ res }) => {
  const posts = await getPosts()
  const sMax = CONFIG.revalidateTime || 6 * 3600

  const escape = (s: string) =>
    s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;")

  const entries = posts
    .map(
      (post: TPost) => `
  <url>
    <loc>${escape(`${CONFIG.link}/${post.slug}`)}</loc>
    <lastmod>${new Date().toISOString()}</lastmod>
    <changefreq>daily</changefreq>
    <priority>0.7</priority>
  </url>`
    )
    .join("")

  const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url>
    <loc>${escape(CONFIG.link)}</loc>
    <lastmod>${new Date().toISOString()}</lastmod>
    <changefreq>daily</changefreq>
    <priority>1.0</priority>
  </url>${entries}
</urlset>`

  res.setHeader("Content-Type", "application/xml; charset=utf-8")
  res.setHeader(
    "Cache-Control",
    `public, s-maxage=${sMax}, stale-while-revalidate=${Math.floor(sMax / 6)}`
  )
  res.write(xml)
  res.end()

  return { props: {} }
}

const Sitemap = () => null
export default Sitemap
