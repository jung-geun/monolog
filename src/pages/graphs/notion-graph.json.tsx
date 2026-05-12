import type { GetServerSideProps } from "next"
import { getNotionGraph } from "src/apis/notion-client/getNotionGraph"
import { CONFIG } from "site.config"

export const getServerSideProps: GetServerSideProps = async ({ res }) => {
  const graph = await getNotionGraph()
  const sMax = CONFIG.revalidateTime || 6 * 3600

  res.setHeader("Content-Type", "application/json; charset=utf-8")
  res.setHeader(
    "Cache-Control",
    `public, s-maxage=${sMax}, stale-while-revalidate=${Math.floor(sMax / 6)}`
  )
  res.write(JSON.stringify(graph))
  res.end()

  return { props: {} }
}

const NotionGraphJson = () => null
export default NotionGraphJson
