import { NextPageWithLayout } from "src/types"
import MetaConfig from "src/components/MetaConfig"
import { CONFIG } from "site.config"
import Search from "src/routes/Search"
import { getPosts } from "src/apis/notion-client/getPosts"
import { createServerQueryClient } from "src/libs/react-query"
import { prefetchFeedPosts } from "src/libs/react-query/prefetchFeedPosts"
import { GetStaticProps } from "next"
import { dehydrate } from "@tanstack/react-query"

export const getStaticProps: GetStaticProps = async () => {
  const queryClient = createServerQueryClient()
  await prefetchFeedPosts(queryClient, await getPosts())
  return {
    props: { dehydratedState: dehydrate(queryClient) },
    revalidate: CONFIG.revalidateTime,
  }
}

const SearchPage: NextPageWithLayout = () => (
  <>
    <MetaConfig
      title={`검색 — ${CONFIG.blog.title}`}
      description={`${CONFIG.blog.title}의 공개 글을 제목, 태그, 분류로 검색합니다.`}
      type="website"
      url={`${CONFIG.link}/search`}
      noindex
    />
    <Search />
  </>
)

export default SearchPage
