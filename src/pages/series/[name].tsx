import { GetStaticPaths, GetStaticProps } from "next"
import { NextPageWithLayout } from "src/types"
import MetaConfig from "src/components/MetaConfig"
import { CONFIG } from "site.config"
import SeriesArchive from "src/routes/SeriesArchive"
import { getPosts } from "src/apis/notion-client/getPosts"
import { filterPosts } from "src/libs/utils/notion"
import { getAllSelectItemsFromPosts } from "src/libs/utils/notion"
import { createServerQueryClient } from "src/libs/react-query"
import { assertFeedNotEmpty, FEED_POSTS_FILTER, prefetchFeedPosts } from "src/libs/react-query/prefetchFeedPosts"
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
  assertFeedNotEmpty(posts)

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
      description={`Posts in the ${seriesName} series`}
      type="website"
      url={`${CONFIG.link}/series/${seriesName}`}
    />
    <SeriesArchive seriesName={seriesName} />
  </>
)

export default SeriesDetailPage
