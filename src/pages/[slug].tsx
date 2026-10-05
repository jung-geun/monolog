import Detail from "src/routes/Detail"
import { filterPosts, optimizeRecordMap } from "src/libs/utils/notion"
import { CONFIG } from "site.config"
import { NextPageWithLayout } from "../types"
import CustomError from "src/routes/Error"
import { getRecordMap, getPosts, getRecordMapDatabases } from "src/apis"
import { getSlugRedirect, readContentRecordMap } from "src/libs/content/registry"
import MetaConfig from "src/components/MetaConfig"
import { GetStaticProps } from "next"
import { createServerQueryClient } from "src/libs/react-query"
import { queryKey } from "src/constants/queryKey"
import { prefetchFeedPosts } from "src/libs/react-query/prefetchFeedPosts"
import { markdownUrl, modifiedDate, postUrl, publishedDate, publicDetails, summaryText } from "src/libs/seo"
import { customMapImageUrl } from "src/libs/utils/notion/customMapImageUrl"
import { getArticleDescription } from "src/libs/utils/notion/articleSummary"
import { dehydrate } from "@tanstack/react-query"
import usePostQuery from "src/hooks/usePostQuery"
import useTrackVisit from "src/hooks/useTrackVisit"
import useArticleAnalytics from "src/hooks/useArticleAnalytics"
import { FilterPostsOptions } from "src/libs/utils/notion/filterPosts"
import { debugLog } from "src/libs/utils/logger"

const filter: FilterPostsOptions = {
  acceptStatus: ["Public", "PublicOnDetail"],
  acceptType: ["Paper", "Post", "Page"],
}

let pathsCache: { ts: number; paths: string[] } | null = null
const PATHS_TTL = 30_000

export const getStaticPaths = async () => {
  if (pathsCache && Date.now() - pathsCache.ts < PATHS_TTL) {
    return { paths: pathsCache.paths, fallback: "blocking" }
  }

  const posts = await getPosts()
  const filteredPost = filterPosts(posts, filter)
  const paths = filteredPost.map((row) => postUrl(row.slug).replace(CONFIG.link.replace(/\/+$/, ""), ""))
  pathsCache = { ts: Date.now(), paths }

  return {
    paths,
    fallback: "blocking",
  }
}

export const getStaticProps: GetStaticProps = async (context) => {
  const slug = context.params?.slug
  if (typeof slug !== "string") return { notFound: true, revalidate: 60 }

  debugLog(`[getStaticProps] slug: "${slug}"`)
  const queryClient = createServerQueryClient()
  const posts = await getPosts()
  await prefetchFeedPosts(queryClient, posts)

  const details = publicDetails(posts)
  const postDetail = details.find((post) => post.slug === slug)
  if (!postDetail) {
    const targetSlug = await getSlugRedirect(slug)
    if (targetSlug && targetSlug !== slug) {
      const target = details.find((post) => post.slug === targetSlug)
      if (target) {
        return { redirect: { destination: postUrl(target.slug), permanent: true }, revalidate: 60 }
      }
    }
  }
  if (!postDetail) return { notFound: true, revalidate: 60 }

  // Render the body published with this registry revision; live Notion is only
  // the cold-registry path. Upstream failures must not replace valid ISR HTML.
  const rawRecordMap = await readContentRecordMap(postDetail.id)
    ?? await getRecordMap(postDetail.id, details, { lastEditedTime: postDetail.lastEditedTime })
  if (!rawRecordMap) throw new Error(`Missing record map for ${slug}`)
  const recordMap = optimizeRecordMap(rawRecordMap)
  if (!recordMap) throw new Error(`Invalid record map for ${slug}`)
  const databases = await getRecordMapDatabases(recordMap)
  for (const [id, database] of databases) {
    queryClient.setQueryData(queryKey.database(id), database)
  }
  queryClient.setQueryData(queryKey.post(slug), { ...postDetail, recordMap })

  return {
    props: { dehydratedState: dehydrate(queryClient) },
    revalidate: CONFIG.revalidateTime,
  }
}

const DetailPage: NextPageWithLayout = () => {
  const post = usePostQuery()
  useTrackVisit(post)
  useArticleAnalytics(post)
  if (!post) return <CustomError />

  let image: string | undefined
  if (post.thumbnail) {
    try {
      const thumbnail = new URL(post.thumbnail, CONFIG.link)
      if (thumbnail.protocol === "https:" || thumbnail.protocol === "http:") {
        const notionImage = /(^|\.)(notion\.so|notion\.com|notion-static\.com|amazonaws\.com)$/i.test(thumbnail.hostname)
        image = notionImage || post.thumbnail.startsWith("/images/")
          ? customMapImageUrl(post.thumbnail, undefined, { pageId: post.id, property: "thumbnail" })
          : thumbnail.toString()
      }
    } catch {
      // Invalid thumbnails use MetaConfig's generated PNG fallback.
    }
  }

  const meta = {
    title: post.title,
    date: publishedDate(post),
    modifiedDate: modifiedDate(post),
    authors: post.author?.map((author) => author.name.trim()).filter(Boolean),
    image,
    description: getArticleDescription(summaryText(post.summary), post.recordMap, post.id),
    type: post.type[0],
    url: postUrl(post.slug),
    alternateMarkdownUrl: markdownUrl(post.slug),
  }

  return (
    <>
      <MetaConfig {...meta} />
      <Detail />
    </>
  )
}

DetailPage.getLayout = (page) => {
  return <>{page}</>
}

export default DetailPage
