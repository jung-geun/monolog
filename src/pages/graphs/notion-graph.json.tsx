import type { GetServerSideProps } from "next"
import { getPosts } from "src/apis/notion-client/getPosts"
import {
  readGraphSnapshotFromQdrant,
  refreshGraphSnapshotInQdrant,
  refreshStaleGraphSnapshotInQdrant,
} from "src/apis/notion-client/graphSnapshot"

const S_MAX = 86400 // 1 day

export const getServerSideProps: GetServerSideProps = async ({ res }) => {
  const posts = await getPosts()
  const snapshot = await readGraphSnapshotFromQdrant(posts)
  let graph = snapshot?.builtGraph
  let isStale = snapshot?.isStale ?? false

  if (!graph) {
    const refreshed = await refreshGraphSnapshotInQdrant({ posts })
    graph = refreshed.builtGraph
    isStale = refreshed.needsRetry
  } else if (isStale) {
    refreshStaleGraphSnapshotInQdrant(posts)
  }

  res.setHeader("Content-Type", "application/json; charset=utf-8")
  res.setHeader("X-Monolog-Graph-Stale", isStale ? "1" : "0")
  res.setHeader(
    "Cache-Control",
    isStale
      ? "no-store"
      : `public, s-maxage=${S_MAX}, stale-while-revalidate=${Math.floor(S_MAX / 6)}`
  )
  res.write(JSON.stringify(graph))
  res.end()

  return { props: {} }
}

const NotionGraphJson = () => null
export default NotionGraphJson
