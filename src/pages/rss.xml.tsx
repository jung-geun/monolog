import type { GetServerSideProps } from "next"
import { getPosts } from "../apis/notion-client/getPosts"
import { CONFIG } from "site.config"
import type { TPost } from "../types"

const escape = (s: string) =>
  s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;")

function toRfc822(raw: string): string {
  const d = new Date(raw)
  if (isNaN(d.getTime())) return new Date().toUTCString()
  return d.toUTCString()
}

export const getServerSideProps: GetServerSideProps = async ({ res }) => {
  const posts = await getPosts()
  const sMax = CONFIG.revalidateTime || 6 * 3600

  const feedUrl = `${CONFIG.link}/rss.xml`
  const now = new Date().toUTCString()

  const items = posts
    .map((post: TPost) => {
      const link = `${CONFIG.link}/${post.slug}`
      const pubDate = toRfc822(post.date?.start_date || post.createdTime || "")
      const categories = (post.category ?? [])
        .map((c) => `<category>${escape(c)}</category>`)
        .join("")
      const description = post.summary
        ? `<description><![CDATA[${post.summary}]]></description>`
        : ""
      return `
  <item>
    <title>${escape(post.title)}</title>
    <link>${escape(link)}</link>
    <guid isPermaLink="false">${escape(post.id)}</guid>
    <pubDate>${pubDate}</pubDate>
    ${description}
    ${categories}
    <author>${escape(CONFIG.profile.email)} (${escape(CONFIG.profile.name)})</author>
  </item>`
    })
    .join("")

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>${escape(CONFIG.blog.title)}</title>
    <link>${escape(CONFIG.link)}</link>
    <description>${escape(CONFIG.blog.description)}</description>
    <language>${escape(CONFIG.lang)}</language>
    <lastBuildDate>${now}</lastBuildDate>
    <atom:link href="${escape(feedUrl)}" rel="self" type="application/rss+xml"/>
    ${items}
  </channel>
</rss>`

  res.setHeader("Content-Type", "application/rss+xml; charset=utf-8")
  res.setHeader(
    "Cache-Control",
    `public, s-maxage=${sMax}, stale-while-revalidate=${Math.floor(sMax / 6)}`
  )
  res.write(xml)
  res.end()

  return { props: {} }
}

const RssFeed = () => null
export default RssFeed
