import { CONFIG } from "site.config"
import Head from "next/head"
import { absoluteUrl, serializeJsonLd, validDate } from "src/libs/seo"

export type MetaConfigProps = {
  title: string
  description: string
  type: "Website" | "Post" | "Paper" | "Page" | string
  date?: string
  modifiedDate?: string
  authors?: string[]
  image?: string
  url: string
  alternateMarkdownUrl?: string
  noindex?: boolean
  breadcrumbs?: { name: string; url: string }[]
}

const MetaConfig: React.FC<MetaConfigProps> = (props) => {
  const canonical = absoluteUrl(props.url)
  const article = props.type === "Post" || props.type === "Paper"
  const published = validDate(props.date)
  const modified = validDate(props.modifiedDate)
  const authors = props.authors?.length ? props.authors : [CONFIG.profile.name]
  const fallbackImage = absoluteUrl("/api/og")
  let image = fallbackImage
  if (props.image) {
    try {
      image = absoluteUrl(props.image)
    } catch {
      // Invalid or non-HTTP thumbnails use the locally generated PNG.
    }
  }
  const home = absoluteUrl("/")
  const person = {
    "@type": "Person", "@id": `${home}#author`,
    name: CONFIG.profile.name, description: CONFIG.profile.bio, jobTitle: CONFIG.profile.role,
    url: absoluteUrl(`/${encodeURIComponent(CONFIG.aboutSlug)}`),
    image: absoluteUrl(CONFIG.profile.image),
    sameAs: [
      CONFIG.profile.github && `https://github.com/${CONFIG.profile.github}`,
      CONFIG.profile.linkedin && `https://www.linkedin.com/in/${CONFIG.profile.linkedin}`,
      CONFIG.profile.instagram && `https://www.instagram.com/${CONFIG.profile.instagram}/`,
    ].filter(Boolean),
  }
  const breadcrumbs = props.breadcrumbs ?? [
    { name: CONFIG.blog.title, url: home },
    ...(canonical !== home ? [{ name: props.title, url: canonical }] : []),
  ]
  const schema = {
    "@context": "https://schema.org",
    "@graph": [
      person,
      {
        "@type": "WebSite", "@id": `${home}#website`, url: home,
        name: CONFIG.blog.title, description: CONFIG.blog.description,
        inLanguage: CONFIG.lang, author: { "@id": person["@id"] },
      },
      {
        "@type": article ? "BlogPosting" : "WebPage", "@id": `${canonical}#content`,
        url: canonical, ...(article ? { headline: props.title } : { name: props.title }),
        description: props.description, image, inLanguage: CONFIG.lang,
        isPartOf: { "@id": `${home}#website` },
        ...(article ? {
          mainEntityOfPage: canonical,
          author: authors.map((name) => name === CONFIG.profile.name
            ? { "@id": person["@id"] } : { "@type": "Person", name }),
          ...(published ? { datePublished: published } : {}),
          ...(modified ? { dateModified: modified } : {}),
        } : {}),
      },
      {
        "@type": "BreadcrumbList",
        itemListElement: breadcrumbs.map((item, index) => ({
          "@type": "ListItem", position: index + 1,
          name: item.name, item: absoluteUrl(item.url),
        })),
      },
    ],
  }

  return (
    <Head>
      <title>{props.title}</title>
      <meta name="robots" content={props.noindex ? "noindex, follow" : "index, follow"} />
      <meta charSet="UTF-8" />
      <meta name="description" content={props.description} />
      <meta name="author" content={authors.join(", ")} />
      <link rel="canonical" href={canonical} />
      <meta property="og:type" content={article ? "article" : "website"} />
      <meta property="og:title" content={props.title} />
      <meta property="og:description" content={props.description} />
      <meta property="og:url" content={canonical} />
      <meta property="og:locale" content="ko_KR" />
      <meta property="og:site_name" content={CONFIG.blog.title} />
      <meta property="og:image" content={image} />
      <meta property="og:image:alt" content={image === fallbackImage ? CONFIG.blog.title : props.title} />
      {image === fallbackImage && <meta property="og:image:type" content="image/png" />}
      <meta name="twitter:title" content={props.title} />
      <meta name="twitter:description" content={props.description} />
      <meta name="twitter:card" content="summary_large_image" />
      <meta name="twitter:image" content={image} />
      {article && <>
        {published && <meta property="article:published_time" content={published} />}
        {modified && <meta property="article:modified_time" content={modified} />}
        {authors.map((name) => <meta key={name} property="article:author" content={name} />)}
      </>}
      <link rel="alternate" type="application/rss+xml" title={`${CONFIG.blog.title} RSS`} href={absoluteUrl("/rss.xml")} />
      {props.alternateMarkdownUrl && <link rel="alternate" type="text/markdown" href={absoluteUrl(props.alternateMarkdownUrl)} />}
      {!props.noindex && <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: serializeJsonLd(schema) }} />}
    </Head>
  )
}

export default MetaConfig
