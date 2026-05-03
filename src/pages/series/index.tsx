import { GetStaticProps } from "next"
import { NextPageWithLayout } from "src/types"
import MetaConfig from "src/components/MetaConfig"
import { CONFIG } from "site.config"
import SeriesList from "src/routes/SeriesList"
import { getPosts } from "src/apis"
import { filterPosts } from "src/libs/utils/notion"
import { createServerQueryClient } from "src/libs/react-query"
import { queryKey } from "src/constants/queryKey"
import { dehydrate } from "@tanstack/react-query"

export const getStaticProps: GetStaticProps = async () => {
  const queryClient = createServerQueryClient()
  const allPosts = await getPosts()

  if (allPosts.length === 0 && process.env.NEXT_PHASE !== "phase-production-build") {
    throw new Error("getPosts returned 0 posts — preserving previous static HTML")
  }

  const posts = filterPosts(allPosts, {
    acceptStatus: ["Public"],
    acceptType: ["Post", "Paper"],
  })

  await queryClient.prefetchQuery({
    queryKey: queryKey.posts(),
    queryFn: () => posts,
    staleTime: 10 * 60 * 1000,
    gcTime: 60 * 60 * 1000,
  })

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
