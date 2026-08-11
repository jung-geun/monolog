import { NextPageWithLayout } from "src/types"
import MetaConfig from "src/components/MetaConfig"
import { CONFIG } from "site.config"
import OntologyView from "src/routes/Ontology"
import { createServerQueryClient } from "src/libs/react-query"
import { GetStaticProps } from "next"
import { dehydrate } from "@tanstack/react-query"
import { getPosts } from "src/apis/notion-client/getPosts"
import { assertFeedNotEmpty, prefetchFeedPosts } from "src/libs/react-query/prefetchFeedPosts"

export const getStaticProps: GetStaticProps = async () => {
  const queryClient = createServerQueryClient()
  const posts = await prefetchFeedPosts(queryClient, await getPosts())
  assertFeedNotEmpty(posts)

  return {
    props: { dehydratedState: dehydrate(queryClient) },
    revalidate: CONFIG.revalidateTime,
  }
}

const OntologyPage: NextPageWithLayout = () => (
  <>
    <MetaConfig
      title={`Ontology — ${CONFIG.blog.title}`}
      description="Semantic entity and relation map of posts"
      type="website"
      url={`${CONFIG.link}/ontology`}
    />
    <OntologyView />
  </>
)

export default OntologyPage
