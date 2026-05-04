import Detail from "src/routes/Detail"
import { filterPosts, optimizeRecordMap, unwrapBlock } from "src/libs/utils/notion"
import { CONFIG } from "site.config"
import { NextPageWithLayout } from "../types"
import CustomError from "src/routes/Error"
import { getRecordMap, getPosts, getPostBySlug, getDatabase } from "src/apis"
import MetaConfig from "src/components/MetaConfig"
import { GetStaticProps } from "next"
import { createServerQueryClient } from "src/libs/react-query"
import { queryKey } from "src/constants/queryKey"
import { dehydrate } from "@tanstack/react-query"
import usePostQuery from "src/hooks/usePostQuery"
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

    const feedPosts = filterPosts(posts, { acceptStatus: ["Public"], acceptType: ["Post", "Paper"] })
    if (feedPosts.length === 0 && process.env.NEXT_PHASE !== "phase-production-build") {
      throw new Error("getPosts returned 0 posts — preserving previous static HTML")
    }
    await queryClient.prefetchQuery({ queryKey: queryKey.posts(), queryFn: () => feedPosts })

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
        const databaseBlockIds = Object.entries(recordMap.block)
          .filter(([, b]) => unwrapBlock(b)?.type === "collection_view_page")
          .map(([id, b]) => ({
            id,
            format: (unwrapBlock(b) as any)?.format,
          }))

        await Promise.all(
          databaseBlockIds.map(async ({ id, format }) => {
            const db = await getDatabase(id, format).catch(() => null)
            if (db) {
              await queryClient.prefetchQuery({ queryKey: queryKey.database(id), queryFn: () => db })
            }
          })
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
