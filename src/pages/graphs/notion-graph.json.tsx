import type { GetServerSideProps } from "next"
import { getPosts } from "src/apis/notion-client/getPosts"
import {
  readGraphSnapshotFromQdrant,
  refreshGraphSnapshotInQdrant,
  refreshStaleGraphSnapshotInQdrant,
} from "src/apis/notion-client/graphSnapshot"

import { withPostEmbeddingPositions } from "src/apis/vector/graphEmbeddings"

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
  const enriched = await withPostEmbeddingPositions(graph, posts)
  isStale ||= enriched.embedding?.pending === true

  res.setHeader("Content-Type", "application/json; charset=utf-8")
  res.setHeader("X-Monolog-Graph-Stale", isStale ? "1" : "0")
  // Embeddings commit independently of relationship snapshots during content
  // maintenance. A CDN copy must not hide newly indexed or withdrawn documents.
  res.setHeader("Cache-Control", "no-store")
  res.write(JSON.stringify(enriched))
  res.end()

  return { props: {} }
}

const NotionGraphJson = () => null
export default NotionGraphJson
