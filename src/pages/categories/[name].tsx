import { GetStaticPaths, GetStaticProps } from "next"
import { NextPageWithLayout } from "src/types"
import MetaConfig from "src/components/MetaConfig"
import { CONFIG } from "site.config"
import Archive from "src/routes/Archive"
import { getPosts } from "src/apis/notion-client/getPosts"
import { filterPosts } from "src/libs/utils/notion"
import { createServerQueryClient } from "src/libs/react-query"
import { FEED_POSTS_FILTER, prefetchFeedPosts } from "src/libs/react-query/prefetchFeedPosts"
import { dehydrate } from "@tanstack/react-query"

type Props = {
  categoryName: string
}

export const getStaticPaths: GetStaticPaths = async () => {
  const posts = filterPosts(await getPosts(), FEED_POSTS_FILTER)

  const cats = new Set<string>()
  for (const post of posts) {
    if (post.category) post.category.forEach((c) => cats.add(c))
  }

  return {
    paths: Array.from(cats).map((name) => ({ params: { name } })),
    fallback: "blocking",
  }
}

export const getStaticProps: GetStaticProps<Props> = async ({ params }) => {
  const queryClient = createServerQueryClient()
  const categoryName = params?.name as string
  const posts = await prefetchFeedPosts(queryClient, await getPosts())
  if (!posts.some((post) => post.category?.includes(categoryName))) {
    return { notFound: true, revalidate: 60 }
  }

  return {
    props: {
      categoryName,
      dehydratedState: dehydrate(queryClient),
    },
    revalidate: CONFIG.revalidateTime,
  }
}

const CategoryPage: NextPageWithLayout<Props> = ({ categoryName }) => (
  <>
    <MetaConfig
      title={`#${categoryName} — ${CONFIG.blog.title}`}
      description={`${categoryName} 분류의 개발 기록과 논문 정리. ${CONFIG.blog.title}에서 관련 글을 찾아보세요.`}
      type="website"
      url={`${CONFIG.link}/categories/${encodeURIComponent(categoryName)}`}
    />
    <Archive categoryName={categoryName} />
  </>
)

export default CategoryPage
