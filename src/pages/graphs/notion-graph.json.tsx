import type { GetServerSideProps } from "next"
import { getPosts } from "src/apis/notion-client/getPosts"
import {
  readGraphSnapshotFromQdrant,
  refreshGraphSnapshotInQdrant,
} from "src/apis/notion-client/graphSnapshot"

const S_MAX = 86400 // 1 day

export const getServerSideProps: GetServerSideProps = async ({ res }) => {
  const posts = await getPosts()
  const graph =
    (await readGraphSnapshotFromQdrant(posts)) ??
    (await refreshGraphSnapshotInQdrant({ posts })).builtGraph

  res.setHeader("Content-Type", "application/json; charset=utf-8")
  res.setHeader(
    "Cache-Control",
    `public, s-maxage=${S_MAX}, stale-while-revalidate=${Math.floor(S_MAX / 6)}`
  )
  res.write(JSON.stringify(graph))
  res.end()

  return { props: {} }
}

const NotionGraphJson = () => null
export default NotionGraphJson
