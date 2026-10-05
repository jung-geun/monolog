import { NextPageWithLayout } from "src/types"
import MetaConfig from "src/components/MetaConfig"
import { CONFIG } from "site.config"
import OntologyView from "src/routes/Ontology"
import { createServerQueryClient } from "src/libs/react-query"
import { GetStaticProps } from "next"
import { dehydrate } from "@tanstack/react-query"
import { getPosts } from "src/apis/notion-client/getPosts"
import { prefetchFeedPosts } from "src/libs/react-query/prefetchFeedPosts"

export const getStaticProps: GetStaticProps = async () => {
  const queryClient = createServerQueryClient()
  await prefetchFeedPosts(queryClient, await getPosts())

  return {
    props: { dehydratedState: dehydrate(queryClient) },
    revalidate: CONFIG.revalidateTime,
  }
}

const OntologyPage: NextPageWithLayout = () => (
  <>
    <MetaConfig
      title={`Ontology — ${CONFIG.blog.title}`}
      description="글에서 추출한 개체와 관계를 탐색하는 대화형 도구입니다."
      type="website"
      url={`${CONFIG.link}/ontology`}
      noindex
    />
    <OntologyView />
  </>
)

export default OntologyPage
