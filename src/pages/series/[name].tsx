import { GetStaticPaths, GetStaticProps } from "next"
import { NextPageWithLayout } from "src/types"
import MetaConfig from "src/components/MetaConfig"
import { CONFIG } from "site.config"
import SeriesArchive from "src/routes/SeriesArchive"
import { getPosts } from "src/apis"
import { filterPosts } from "src/libs/utils/notion"
import { getAllSelectItemsFromPosts } from "src/libs/utils/notion"
import { createServerQueryClient } from "src/libs/react-query"
import { queryKey } from "src/constants/queryKey"
import { dehydrate } from "@tanstack/react-query"

type Props = {
  seriesName: string
}

export const getStaticPaths: GetStaticPaths = async () => {
  const posts = filterPosts(await getPosts(), {
    acceptStatus: ["Public"],
    acceptType: ["Post", "Paper"],
  })

  const seriesMap = getAllSelectItemsFromPosts("series", posts)

  return {
    paths: Object.keys(seriesMap).map((name) => ({ params: { name } })),
    fallback: "blocking",
  }
}

export const getStaticProps: GetStaticProps<Props> = async ({ params }) => {
  const queryClient = createServerQueryClient()
  const seriesName = params?.name as string
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
