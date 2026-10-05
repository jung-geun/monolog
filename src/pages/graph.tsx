import { NextPageWithLayout } from "src/types"
import MetaConfig from "src/components/MetaConfig"
import { CONFIG } from "site.config"
import Graph from "src/routes/Graph"
import { createServerQueryClient } from "src/libs/react-query"
import { GetStaticProps } from "next"
import { dehydrate } from "@tanstack/react-query"
import { getPosts } from "src/apis/notion-client/getPosts"
import { prefetchFeedPosts } from "src/libs/react-query/prefetchFeedPosts"

export const getStaticProps: GetStaticProps = async () => {
  const queryClient = createServerQueryClient()
  await prefetchFeedPosts(queryClient, await getPosts())

  return {
    props: { dehydratedState: dehydrate(queryClient) },
    revalidate: CONFIG.revalidateTime,
  }
}

const GraphPage: NextPageWithLayout = () => (
  <>
    <MetaConfig
      title={`Knowledge Graph — ${CONFIG.blog.title}`}
      description="공개 글과 글 사이의 연결을 탐색하는 대화형 지식 그래프입니다."
      type="website"
      url={`${CONFIG.link}/graph`}
      noindex
    />
    <Graph />
  </>
)

export default GraphPage
