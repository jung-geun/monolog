import { NextPageWithLayout } from "src/types"
import MetaConfig from "src/components/MetaConfig"
import { CONFIG } from "site.config"
import Graph from "src/routes/Graph"
import { getPosts } from "src/apis"
import { createServerQueryClient } from "src/libs/react-query"
import { queryKey } from "src/constants/queryKey"
import { GetStaticProps } from "next"
import { dehydrate } from "@tanstack/react-query"
import { filterPosts } from "src/libs/utils/notion"

export const getStaticProps: GetStaticProps = async () => {
  const queryClient = createServerQueryClient()
  const posts = filterPosts(await getPosts(), {
    acceptStatus: ["Public"],
    acceptType: ["Post", "Paper"],
  })
  await queryClient.prefetchQuery({
    queryKey: queryKey.posts(),
    queryFn: () => posts,
  })
  return {
    props: { dehydratedState: dehydrate(queryClient) },
    revalidate: CONFIG.revalidateTime,
  }
}

const GraphPage: NextPageWithLayout = () => (
  <>
    <MetaConfig
      title={`Knowledge Graph — ${CONFIG.blog.title}`}
      description="Visual map of posts and their connections"
      type="website"
      url={`${CONFIG.link}/graph`}
    />
    <Graph />
  </>
)

export default GraphPage
