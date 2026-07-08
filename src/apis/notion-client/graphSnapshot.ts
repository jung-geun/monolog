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
}

export async function readGraphSnapshotFromQdrant(posts?: TPosts): Promise<BuiltGraph | null> {
  const currentPosts = posts ?? (await getPosts())
  const graphHash = computePostsGraphHash(currentPosts)
  const snapshot = await getGraphSnapshot(graphHash)
  return snapshot?.builtGraph ?? null
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
    return { graphHash, notionGraph, builtGraph }
  }

  try {
    await upsertGraphSnapshot(graphHash, notionGraph, builtGraph)
  } catch (err) {
    warnLog("[graphSnapshot] failed to persist graph snapshot:", err)
  }

  return { graphHash, notionGraph, builtGraph }
}
