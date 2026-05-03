import { GetStaticPaths, GetStaticProps } from "next"
import { NextPageWithLayout } from "src/types"
import MetaConfig from "src/components/MetaConfig"
import { CONFIG } from "site.config"
import Archive from "src/routes/Archive"
import { getPosts } from "src/apis"
import { filterPosts } from "src/libs/utils/notion"
import { createServerQueryClient } from "src/libs/react-query"
import { queryKey } from "src/constants/queryKey"
import { dehydrate } from "@tanstack/react-query"

type Props = {
  categoryName: string
}

export const getStaticPaths: GetStaticPaths = async () => {
  const posts = filterPosts(await getPosts(), {
    acceptStatus: ["Public"],
    acceptType: ["Post", "Paper"],
  })

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
    staleTime: 10 * 60 * 1000,
    gcTime: 60 * 60 * 1000,
  })

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
      description={`Posts in the ${categoryName} category`}
      type="website"
      url={`${CONFIG.link}/categories/${categoryName}`}
    />
    <Archive categoryName={categoryName} />
  </>
)

export default CategoryPage
