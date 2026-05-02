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
  const posts = filterPosts(await getPosts(), {
    acceptStatus: ["Public"],
    acceptType: ["Post", "Paper"], // Paper 타입도 메인페이지에 포함
  })
  
  // React Query 캐시에 데이터 저장 (더 오래 유지되도록 설정)
  await queryClient.prefetchQuery({
    queryKey: queryKey.posts(),
    queryFn: () => posts,
    staleTime: 10 * 60 * 1000, // 10분 동안 fresh 유지
    cacheTime: 60 * 60 * 1000, // 1시간 동안 캐시 보관
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
