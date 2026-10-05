import { GetStaticPaths, GetStaticProps } from "next"
import { NextPageWithLayout } from "src/types"
import MetaConfig from "src/components/MetaConfig"
import { CONFIG } from "site.config"
import SeriesArchive from "src/routes/SeriesArchive"
import { getPosts } from "src/apis/notion-client/getPosts"
import { filterPosts } from "src/libs/utils/notion"
import { getAllSelectItemsFromPosts } from "src/libs/utils/notion"
import { createServerQueryClient } from "src/libs/react-query"
import { FEED_POSTS_FILTER, prefetchFeedPosts } from "src/libs/react-query/prefetchFeedPosts"
import { dehydrate } from "@tanstack/react-query"

type Props = {
  seriesName: string
}

export const getStaticPaths: GetStaticPaths = async () => {
  const posts = filterPosts(await getPosts(), FEED_POSTS_FILTER)

  const seriesMap = getAllSelectItemsFromPosts("series", posts)

  return {
    paths: Object.keys(seriesMap).map((name) => ({ params: { name } })),
    fallback: "blocking",
  }
}

export const getStaticProps: GetStaticProps<Props> = async ({ params }) => {
  const queryClient = createServerQueryClient()
  const seriesName = params?.name as string
  const posts = await prefetchFeedPosts(queryClient, await getPosts())
  if (!posts.some((post) => post.series?.includes(seriesName))) {
    return { notFound: true, revalidate: 60 }
  }

  return {
    props: {
      seriesName,
      dehydratedState: dehydrate(queryClient),
    },
    revalidate: CONFIG.revalidateTime,
  }
}

const SeriesDetailPage: NextPageWithLayout<Props> = ({ seriesName }) => (
  <>
    <MetaConfig
      title={`${seriesName} — ${CONFIG.blog.title}`}
      description={`${seriesName} 연재의 글을 모았습니다. ${CONFIG.blog.title}에서 시리즈의 흐름을 따라 읽어보세요.`}
      type="website"
      url={`${CONFIG.link}/series/${encodeURIComponent(seriesName)}`}
      breadcrumbs={[
        { name: CONFIG.blog.title, url: CONFIG.link },
        { name: "연재 목록", url: `${CONFIG.link}/series` },
        { name: seriesName, url: `${CONFIG.link}/series/${encodeURIComponent(seriesName)}` },
      ]}
    />
    <SeriesArchive seriesName={seriesName} />
  </>
)

export default SeriesDetailPage
