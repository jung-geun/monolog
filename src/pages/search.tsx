import { NextPageWithLayout } from "src/types"
import MetaConfig from "src/components/MetaConfig"
import { CONFIG } from "site.config"
import Search from "src/routes/Search"
import { getPosts } from "src/apis"
import { queryClient } from "src/libs/react-query"
import { queryKey } from "src/constants/queryKey"
import { GetStaticProps } from "next"
import { dehydrate } from "@tanstack/react-query"
import { filterPosts } from "src/libs/utils/notion"

export const getStaticProps: GetStaticProps = async () => {
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
  })
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
