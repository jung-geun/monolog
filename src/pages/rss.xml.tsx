import type { GetServerSideProps } from "next"
import { getPosts } from "src/apis/notion-client/getPosts"
import { CONFIG } from "site.config"
import { filterPosts } from "src/libs/utils/notion/filterPosts"
import { absoluteUrl, escapeXml, modifiedDate, postUrl, publishedDate, summaryText } from "src/libs/seo"
import { errorLog } from "src/libs/utils/logger"

export const getServerSideProps: GetServerSideProps = async ({ req, res }) => {
  res.setHeader("Cache-Control", "no-store")
  try {
    const posts = filterPosts(await getPosts())
    let latestContent: string | undefined
    const items = posts.map((post) => {
      const link = postUrl(post.slug)
      const published = publishedDate(post)
      const modified = modifiedDate(post)
      for (const date of [published, modified]) {
        if (date && (!latestContent || date > latestContent)) latestContent = date
      }
      const categories = (post.category ?? [])
        .map((category) => `<category>${escapeXml(category)}</category>`)
        .join("")
      const summary = summaryText(post.summary)
      const description = summary
        ? `<description><![CDATA[${summary.replace(/\]\]>/g, "]]]]><![CDATA[>")}]]></description>`
        : ""
      return `
    <item>
      <title>${escapeXml(post.title)}</title>
      <link>${escapeXml(link)}</link>
      <guid isPermaLink="false">${escapeXml(post.id)}</guid>
      ${published ? `<pubDate>${new Date(published).toUTCString()}</pubDate>` : ""}
      ${description}
      ${categories}
      <author>${escapeXml(CONFIG.profile.email)} (${escapeXml(CONFIG.profile.name)})</author>
    </item>`
    }).join("")

    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>${escapeXml(CONFIG.blog.title)}</title>
    <link>${escapeXml(absoluteUrl("/"))}</link>
    <description>${escapeXml(CONFIG.blog.description)}</description>
    <language>${escapeXml(CONFIG.lang)}</language>
    ${latestContent ? `<lastBuildDate>${new Date(latestContent).toUTCString()}</lastBuildDate>` : ""}
    <atom:link href="${escapeXml(absoluteUrl("/rss.xml"))}" rel="self" type="application/rss+xml"/>
    ${items}
  </channel>
</rss>`
    res.setHeader("Content-Type", "application/rss+xml; charset=utf-8")
    res.end(req.method === "HEAD" ? undefined : xml)
  } catch (error) {
    errorLog("Error generating RSS:", error)
    res.statusCode = 503
    res.setHeader("Content-Type", "text/plain; charset=utf-8")
    res.setHeader("Retry-After", "60")
    res.end(req.method === "HEAD" ? undefined : "RSS temporarily unavailable\n")
  }
  return { props: {} }
}

const RssFeed = () => null
export default RssFeed
