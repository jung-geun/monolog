import type { BuiltGraph } from "src/apis/notion-client/getBuiltGraph"
import type { TPosts } from "src/types"
import type { NotionGraph } from "src/types/notionGraph"
import { warnLog } from "src/libs/utils/logger"
import { getGraphSnapshot, upsertGraphSnapshot } from "src/apis/vector/qdrantGraphStore"
import { getBuiltGraph } from "./getBuiltGraph"
import { computePostsGraphHash, eligibleGraphPosts } from "./graphHash"
import { getNotionGraph } from "./getNotionGraph"
import { getPosts } from "./getPosts"
import { buildPropertyEdges } from "./buildNotionGraph"
import { CONFIG } from "site.config"

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

export function pruneNotionGraph(graph: NotionGraph, posts: TPosts): NotionGraph {
  const postMap = new Map(eligibleGraphPosts(posts).map((post) => [post.id, post]))
  const postNodes = graph.nodes.flatMap((node) => {
    if (node.kind !== "post") return []
    const post = postMap.get(node.id)
    return post ? [{ ...node, title: post.title, slug: post.slug, category: post.category?.[0] ?? "misc", tags: post.tags ?? [], url: `${CONFIG.link}/${post.slug}`, createdAt: post.createdTime }] : []
  })
  const retainedIds = new Set(postNodes.map((node) => node.id))
  const { hubNodes, propertyEdges } = buildPropertyEdges([...postMap.values()].filter((post) => retainedIds.has(post.id)))
  return { ...graph, nodes: [...postNodes, ...hubNodes], edges: [
    ...graph.edges.filter((edge) => retainedIds.has(edge.source) && retainedIds.has(edge.target)),
    ...propertyEdges,
  ] }
}

// Metadata-only removal; never fetches blocks or invokes AI. Keep the old hash so additions/edits still refresh.
export async function pruneGraphSnapshotInQdrant(posts: TPosts): Promise<void> {
  const snapshot = await getGraphSnapshot()
  if (!snapshot) return
  const notionGraph = pruneNotionGraph(snapshot.notionGraph, posts)
  if (JSON.stringify(notionGraph) === JSON.stringify(snapshot.notionGraph)) return
  const builtGraph = await getBuiltGraph({ notionGraph })
  await upsertGraphSnapshot(snapshot.graphHash, notionGraph, builtGraph)
}

export async function readGraphSnapshotFromQdrant(
  posts?: TPosts
): Promise<GraphSnapshotReadResult | null> {
  const currentPosts = eligibleGraphPosts(posts ?? await getPosts())
  const graphHash = computePostsGraphHash(currentPosts)
  const snapshot = await getGraphSnapshot()
  if (!snapshot) return null
  const isStale = snapshot.graphHash !== graphHash
  const safeGraph = pruneNotionGraph(snapshot.notionGraph, currentPosts)
  return {
    builtGraph: isStale ? await getBuiltGraph({ notionGraph: safeGraph }) : snapshot.builtGraph,
    isStale,
  }
}

export async function refreshGraphSnapshotInQdrant(
  input: GraphSnapshotRefreshInput = {}
): Promise<GraphSnapshotRefreshResult> {
  const posts = eligibleGraphPosts(input.posts ?? await getPosts(input.bypassCache ? { bypassCache: true } : undefined))
  const graphHash = computePostsGraphHash(posts)
  const notionGraph =
    input.notionGraph ??
    (await getNotionGraph({ posts, bypassCache: input.bypassCache }))
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
