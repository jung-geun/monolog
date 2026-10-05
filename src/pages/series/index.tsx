import { GetStaticProps } from "next"
import { NextPageWithLayout } from "src/types"
import MetaConfig from "src/components/MetaConfig"
import { CONFIG } from "site.config"
import SeriesList from "src/routes/SeriesList"
import { getPosts } from "src/apis/notion-client/getPosts"
import { createServerQueryClient } from "src/libs/react-query"
import { prefetchFeedPosts } from "src/libs/react-query/prefetchFeedPosts"
import { dehydrate } from "@tanstack/react-query"

export const getStaticProps: GetStaticProps = async () => {
  const queryClient = createServerQueryClient()
  await prefetchFeedPosts(queryClient, await getPosts())

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
      title={`연재 목록 — ${CONFIG.blog.title}`}
      description={`${CONFIG.blog.title}의 주제별 연재를 모았습니다. 시리즈를 선택해 연결된 글을 순서대로 읽어보세요.`}
      type="website"
      url={`${CONFIG.link}/series`}
    />
    <SeriesList />
  </>
)

export default SeriesIndexPage
