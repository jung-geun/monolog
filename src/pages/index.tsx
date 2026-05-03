import Feed from "src/routes/Feed"
import { CONFIG } from "../../site.config"
import { NextPageWithLayout } from "../types"
import { getPosts } from "../apis"
import MetaConfig from "src/components/MetaConfig"
import { queryClient } from "src/libs/react-query"
import { queryKey } from "src/constants/queryKey"
import { GetStaticProps } from "next"
import { dehydrate } from "@tanstack/react-query"
import { filterPosts } from "src/libs/utils/notion"

export const getStaticProps: GetStaticProps = async () => {
  const allPosts = await getPosts()
  const posts = filterPosts(allPosts, {
    acceptStatus: ["Public"],
    acceptType: ["Post", "Paper"],
  })

  if (posts.length === 0 && process.env.NEXT_PHASE !== "phase-production-build") {
    throw new Error("getPosts returned 0 posts — preserving previous static HTML")
  }

  await queryClient.prefetchQuery({
    queryKey: queryKey.posts(),
    queryFn: () => posts,
    staleTime: 10 * 60 * 1000, // 10분 동안 fresh 유지
    gcTime: 60 * 60 * 1000, // 1시간 동안 캐시 보관
  })

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
