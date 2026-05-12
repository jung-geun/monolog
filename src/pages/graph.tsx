import { NextPageWithLayout } from "src/types"
import MetaConfig from "src/components/MetaConfig"
import { CONFIG } from "site.config"
import Graph from "src/routes/Graph"
import { createServerQueryClient } from "src/libs/react-query"
import { queryKey } from "src/constants/queryKey"
import { GetServerSideProps } from "next"
import { dehydrate } from "@tanstack/react-query"
import { getNotionGraph } from "src/apis/notion-client/getNotionGraph"

export const getServerSideProps: GetServerSideProps = async () => {
  const queryClient = createServerQueryClient()
  try {
    const graph = await getNotionGraph()
    await queryClient.prefetchQuery({
      queryKey: queryKey.notionGraph(),
      queryFn: () => graph,
    })
  } catch {
    // Graph not yet available — page renders with empty graph
  }
  return { props: { dehydratedState: dehydrate(queryClient) } }
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
