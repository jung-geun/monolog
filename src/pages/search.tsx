import { NextPageWithLayout } from "src/types"
import MetaConfig from "src/components/MetaConfig"
import { CONFIG } from "site.config"
import Search from "src/routes/Search"
import { getPosts } from "src/apis/notion-client/getPosts"
import { createServerQueryClient } from "src/libs/react-query"
import { assertFeedNotEmpty, prefetchFeedPosts } from "src/libs/react-query/prefetchFeedPosts"
import { GetStaticProps } from "next"
import { dehydrate } from "@tanstack/react-query"

export const getStaticProps: GetStaticProps = async () => {
  const queryClient = createServerQueryClient()
  const posts = await prefetchFeedPosts(queryClient, await getPosts())
  assertFeedNotEmpty(posts)
  return {
    props: { dehydratedState: dehydrate(queryClient) },
    revalidate: CONFIG.revalidateTime,
  }
}

const SearchPage: NextPageWithLayout = () => (
  <>
    <MetaConfig
      title={`Search — ${CONFIG.blog.title}`}
      description="Search posts, tags, and categories"
      type="website"
      url={`${CONFIG.link}/search`}
    />
    <Search />
  </>
)

export default SearchPage
