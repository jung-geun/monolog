import Feed from "src/routes/Feed"
import { CONFIG } from "../../site.config"
import { NextPageWithLayout } from "../types"
import { getPosts } from "src/apis/notion-client/getPosts"
import MetaConfig from "src/components/MetaConfig"
import { createServerQueryClient } from "src/libs/react-query"
import { assertFeedNotEmpty, prefetchFeedPosts } from "src/libs/react-query/prefetchFeedPosts"
import { GetStaticProps } from "next"
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

const FeedPage: NextPageWithLayout = () => {
  const meta = {
    title: CONFIG.blog.title,
    description: CONFIG.blog.description,
    type: "website",
    url: CONFIG.link,
  }

  return (
    <>
      <MetaConfig {...meta} />
      <Feed />
    </>
  )
}

export default FeedPage
