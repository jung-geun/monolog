import { getPosts } from "../apis/notion-client/getPosts"
import { CONFIG } from "site.config"
import { getServerSideSitemap, ISitemapField } from "next-sitemap"
import { GetServerSideProps } from "next"
import { TPost } from "../types"

export const getServerSideProps: GetServerSideProps = async (ctx) => {
  const posts = await getPosts()
  const dynamicPaths = posts.map((post: TPost) => `${CONFIG.link}/${post.slug}`)

  // Create an array of fields, each with a loc and lastmod
  const fields: ISitemapField[] = dynamicPaths.map((path: string) => ({
    loc: path,
    lastmod: new Date().toISOString(),
    priority: 0.7,
    changefreq: "daily",
  }))

  // Include the site root separately
  fields.unshift({
    loc: CONFIG.link,
    lastmod: new Date().toISOString(),
    priority: 1.0,
    changefreq: "daily",
  })

  // Set CDN cache header so sitemap will be cached by the edge for revalidateTime
  const sMax = CONFIG.revalidateTime || 6 * 3600
  try {
    ctx.res.setHeader('Cache-Control', `public, s-maxage=${sMax}, stale-while-revalidate=${Math.floor(sMax / 6)}`)
  } catch {
    // ignore when ctx.res is not available
  }

  return getServerSideSitemap(ctx, fields)
}

// Default export to prevent next.js errors
const Sitemap = () => null

export default Sitemap
