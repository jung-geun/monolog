import type { BuiltGraph } from "src/apis/notion-client/getBuiltGraph"
import type { TPosts } from "src/types"
import type { NotionGraph } from "src/types/notionGraph"
import { warnLog } from "src/libs/utils/logger"
import { getGraphSnapshot, upsertGraphSnapshot } from "src/apis/vector/qdrantGraphStore"
import { getBuiltGraph } from "./getBuiltGraph"
import { computePostsGraphHash } from "./graphHash"
import { getNotionGraph } from "./getNotionGraph"
import { getPosts } from "./getPosts"

export type GraphSnapshotRefreshInput = {
  posts?: TPosts
  notionGraph?: NotionGraph
  builtGraph?: BuiltGraph
  bypassCache?: boolean
}

export type GraphSnapshotRefreshResult = {
  graphHash: string
  notionGraph: NotionGraph
  builtGraph: BuiltGraph
  persisted: boolean
  needsRetry: boolean
}

export type GraphSnapshotReadResult = {
  builtGraph: BuiltGraph
  isStale: boolean
}

let staleSnapshotRefresh: Promise<void> | null = null

export async function readGraphSnapshotFromQdrant(
  posts?: TPosts
): Promise<GraphSnapshotReadResult | null> {
  const currentPosts = posts ?? (await getPosts())
  const graphHash = computePostsGraphHash(currentPosts)
  const snapshot = await getGraphSnapshot()
  if (!snapshot) return null

  return {
    builtGraph: snapshot.builtGraph,
    isStale: snapshot.graphHash !== graphHash,
  }
}

export async function refreshGraphSnapshotInQdrant(
  input: GraphSnapshotRefreshInput = {}
): Promise<GraphSnapshotRefreshResult> {
  const posts =
    input.posts ?? (await getPosts(input.bypassCache ? { bypassCache: true } : undefined))
  const graphHash = computePostsGraphHash(posts)
  const notionGraph =
    input.notionGraph ??
    (await getNotionGraph(input.bypassCache ? { bypassCache: true } : undefined))
  const builtGraph =
    input.builtGraph ??
    (await getBuiltGraph({ bypassCache: input.bypassCache, notionGraph }))

  if (notionGraph.partial === true) {
    return { graphHash, notionGraph, builtGraph, persisted: false, needsRetry: true }
  }

  let persisted = false
  let needsRetry = false
  try {
    persisted = await upsertGraphSnapshot(graphHash, notionGraph, builtGraph)
  } catch (err) {
    needsRetry = true
    warnLog("[graphSnapshot] failed to persist graph snapshot:", err)
  }

  return { graphHash, notionGraph, builtGraph, persisted, needsRetry }
}

export function refreshStaleGraphSnapshotInQdrant(posts: TPosts): void {
  if (staleSnapshotRefresh) return

  staleSnapshotRefresh = refreshGraphSnapshotInQdrant({ posts, bypassCache: true })
    .then(() => undefined)
    .catch((err) => {
      warnLog("[graphSnapshot] failed to refresh stale graph snapshot:", err)
    })
    .finally(() => {
      staleSnapshotRefresh = null
    })
}
