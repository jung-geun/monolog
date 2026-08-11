import Detail from "src/routes/Detail"
import { filterPosts, optimizeRecordMap } from "src/libs/utils/notion"
import { CONFIG } from "site.config"
import { NextPageWithLayout } from "../types"
import CustomError from "src/routes/Error"
import { getRecordMap, getPosts, getPostBySlug, getRecordMapDatabases } from "src/apis"
import MetaConfig from "src/components/MetaConfig"
import { GetStaticProps } from "next"
import { createServerQueryClient } from "src/libs/react-query"
import { queryKey } from "src/constants/queryKey"
import { assertFeedNotEmpty, prefetchFeedPosts } from "src/libs/react-query/prefetchFeedPosts"
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
    return { paths: pathsCache.paths, fallback: true }
  }

  const posts = await getPosts()
  const filteredPost = filterPosts(posts, filter)
  const paths = filteredPost.map((row) => `/${row.slug}`)
  pathsCache = { ts: Date.now(), paths }

  return {
    paths,
    fallback: true,
  }
}

export const getStaticProps: GetStaticProps = async (context) => {
  const slug = context.params?.slug

  debugLog(`[getStaticProps] slug: "${slug}"`)

  try {
    const queryClient = createServerQueryClient()
    const posts = await getPosts()

    const feedPosts = await prefetchFeedPosts(queryClient, posts)
    assertFeedNotEmpty(feedPosts)

    const detailPosts = filterPosts(posts, filter)
    let postDetail = detailPosts.find((t: any) => t.slug === slug)

    if (!postDetail) {
      debugLog(`[getStaticProps] slug "${slug}" not in build-time list, fetching from Notion`)
      const notionPost = await getPostBySlug(slug as string)

      if (!notionPost) {
        return { notFound: true }
      }

      postDetail = notionPost
    }

    try {
      const rawRecordMap = await getRecordMap(postDetail?.id!, posts)
      const recordMap = optimizeRecordMap(rawRecordMap)

      if (recordMap) {
        const databases = await getRecordMapDatabases(recordMap)
        await Promise.all(
          Array.from(databases.entries()).map(([id, db]) =>
            queryClient.prefetchQuery({ queryKey: queryKey.database(id), queryFn: () => db })
          )
        )
      }

      await queryClient.prefetchQuery({ queryKey: queryKey.post(`${slug}`), queryFn: () => ({ ...postDetail, recordMap }) })

      return {
        props: {
          dehydratedState: dehydrate(queryClient),
        },
        revalidate: CONFIG.revalidateTime,
      }
    } catch (recordMapError) {
      console.error(`Failed to get record map for ${slug}:`, recordMapError)

      await queryClient.prefetchQuery({ queryKey: queryKey.post(`${slug}`), queryFn: () => ({ ...postDetail, recordMap: null }) })

      return {
        props: {
          dehydratedState: dehydrate(queryClient),
        },
        revalidate: 60,
      }
    }
  } catch (error) {
    console.error(`Error in getStaticProps for ${slug}:`, error)

    return {
      notFound: true,
    }
  }
}

const DetailPage: NextPageWithLayout = () => {
  const post = usePostQuery()
  useTrackVisit(post)
  useArticleAnalytics(post)
  if (!post) return <CustomError />

  const image =
    post.thumbnail ??
    CONFIG.ogImageGenerateURL ??
    `${CONFIG.ogImageGenerateURL}/${encodeURIComponent(post.title)}.png`

  const date = post.date?.start_date || post.createdTime || ""

  const meta = {
    title: post.title,
    date: new Date(date).toISOString(),
    image: image,
    description: post.summary || "",
    type: post.type[0],
    url: `${CONFIG.link}/${post.slug}`,
    alternateMarkdownUrl: `${CONFIG.link}/${post.slug}.md`,
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
