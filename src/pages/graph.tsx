import { NextPageWithLayout } from "src/types"
import MetaConfig from "src/components/MetaConfig"
import { CONFIG } from "site.config"
import Graph from "src/routes/Graph"
import { createServerQueryClient } from "src/libs/react-query"
import { GetStaticProps } from "next"
import { dehydrate } from "@tanstack/react-query"

export const getStaticProps: GetStaticProps = async () => {
  const queryClient = createServerQueryClient()
  return {
    props: { dehydratedState: dehydrate(queryClient) },
    revalidate: CONFIG.revalidateTime,
  }
}

const GraphPage: NextPageWithLayout = () => (
  <>
    <MetaConfig
      title={`Knowledge Graph — ${CONFIG.blog.title}`}
      description="Visual map of posts and their connections"
      type="website"
      url={`${CONFIG.link}/graph`}
    />
    <Graph />
  </>
)

export default GraphPage
