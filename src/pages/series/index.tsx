import { GetStaticProps } from "next"
import { NextPageWithLayout } from "src/types"
import MetaConfig from "src/components/MetaConfig"
import { CONFIG } from "site.config"
import SeriesList from "src/routes/SeriesList"
import { getPosts } from "src/apis/notion-client/getPosts"
import { createServerQueryClient } from "src/libs/react-query"
import { assertFeedNotEmpty, prefetchFeedPosts } from "src/libs/react-query/prefetchFeedPosts"
import { dehydrate } from "@tanstack/react-query"

export const getStaticProps: GetStaticProps = async () => {
  const queryClient = createServerQueryClient()
  const posts = await prefetchFeedPosts(queryClient, await getPosts())
  assertFeedNotEmpty(posts)

  return {
    props: {
      dehydratedState: dehydrate(queryClient),
    },
    revalidate: CONFIG.revalidateTime,
  }
}

const SeriesIndexPage: NextPageWithLayout = () => (
  <>
    <MetaConfig
      title={`Series — ${CONFIG.blog.title}`}
      description={`All series on ${CONFIG.blog.title}`}
      type="website"
      url={`${CONFIG.link}/series`}
    />
    <SeriesList />
  </>
)

export default SeriesIndexPage
