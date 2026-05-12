import Detail from "src/routes/Detail"
import { filterPosts, optimizeRecordMap, unwrapBlock } from "src/libs/utils/notion"
import { CONFIG } from "site.config"
import { NextPageWithLayout } from "../types"
import CustomError from "src/routes/Error"
import { getRecordMap, getPosts, getPostBySlug, getDatabase } from "src/apis"
import { getOfficialNotionClient } from "src/apis/notion-client/notionClient"
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
        const notion = getOfficialNotionClient()
        const dbBlocks = Object.entries(recordMap.block)
          .filter(([, b]) => unwrapBlock(b)?.type === "collection_view_page")
          .map(([id, b]) => ({ id, format: (unwrapBlock(b) as any)?.format }))

        // Pass 1: retrieve metadata for every DB block in parallel.
        const metaResults = await Promise.all(
          dbBlocks.map(({ id }) =>
            notion.databases
              .retrieve({ database_id: id })
              .then((m: any) => ({ id, meta: m }))
              .catch((e: any) => {
                const code = e?.code ?? e?.status ?? ""
                debugLog(`[prefetch] retrieve failed for ${id} [${code}]: ${e?.message ?? e}`)
                return { id, meta: null as any }
              })
          )
        )

        // Title normalize — NFC + trim. Invisible/zero-width chars or different
        // unicode forms (e.g. Korean NFD vs NFC) would otherwise cause cache
        // misses across a linked view and its source.
        const normTitle = (s: any): string =>
          typeof s === "string" ? s.normalize("NFC").trim() : ""

        // Pass 2a: title → dataSourceId index from source DBs.
        const titleToDsId = new Map<string, string>()
        for (const { meta } of metaResults) {
          const dsId: string | undefined = meta?.data_sources?.[0]?.id
          const title = normTitle(meta?.title?.[0]?.plain_text)
          if (dsId && title) {
            if (titleToDsId.has(title) && titleToDsId.get(title) !== dsId) {
              debugLog(`[prefetch] ambiguous linked-DB title "${title}" — multiple sources; last one wins`)
            }
            titleToDsId.set(title, dsId)
          }
        }

        // Pass 2b: if the page contains exactly one distinct source data_source,
        // use it as a last-resort fallback for any linked block whose title
        // match failed (e.g. retrieve failed, title was renamed). This matches
        // the most common "1 source + N linked views on the same page" pattern.
        const distinctSourceDsIds = Array.from(
          new Set(
            metaResults
              .map(({ meta }) => meta?.data_sources?.[0]?.id as string | undefined)
              .filter((v): v is string => Boolean(v))
          )
        )
        const singleSourceFallback =
          distinctSourceDsIds.length === 1 ? distinctSourceDsIds[0] : undefined

        // Pass 3: prefetch each DB, resolving linked views via cascading fallback:
        //   own data_source → title match → single-source fallback → empty shell
        await Promise.all(
          dbBlocks.map(async ({ id, format }) => {
            const m = metaResults.find((x) => x.id === id)?.meta
            const ownDsId: string | undefined = m?.data_sources?.[0]?.id
            const title = normTitle(m?.title?.[0]?.plain_text)
            const byTitle = !ownDsId ? titleToDsId.get(title) : undefined
            const fallbackDataSourceId: string | undefined =
              ownDsId ? undefined : byTitle ?? singleSourceFallback

            if (ownDsId) {
              debugLog(`[prefetch] ${id} source self ds=${ownDsId} title="${title}"`)
            } else if (byTitle) {
              debugLog(`[prefetch] ${id} linked → title-match ds=${byTitle} title="${title}"`)
            } else if (singleSourceFallback) {
              debugLog(
                `[prefetch] ${id} linked → single-source fallback ds=${singleSourceFallback} title="${title}"`
              )
            } else {
              debugLog(`[prefetch] ${id} linked — no resolution (empty shell) title="${title}"`)
            }

            const db = await getDatabase(id, format, {
              dbMeta: m,
              fallbackDataSourceId,
            }).catch(() => null)
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
