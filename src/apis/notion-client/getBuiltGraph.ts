import { createHash } from "crypto"
import {
  forceSimulation,
  forceLink,
  forceManyBody,
  forceCenter,
  forceCollide,
  forceX,
  forceY,
} from "d3-force"
import { cacheStore, keys } from "src/libs/cache"
import { getPosts } from "./getPosts"
import { getNotionGraph } from "./getNotionGraph"
import { buildGraph, GraphNode, GraphEdge } from "src/libs/utils/graph"

export type BuiltGraph = {
  nodes: GraphNode[]
  edges: GraphEdge[]
  cats: string[]
  catCenters: Record<string, { x: number; y: number }>
  generatedAt: string
}

const W = 720
const H = 520
const BUILT_GRAPH_TTL_MS = 24 * 60 * 60 * 1000

function computePostsHash(posts: { id: string; lastEditedTime?: string; createdTime: string }[]) {
  const sig = posts.map((p) => `${p.id}:${p.lastEditedTime ?? p.createdTime}`).sort().join("|")
  return createHash("sha1").update(sig).digest("hex").slice(0, 16)
}

// Run D3 force simulation synchronously to convergence (server-side, no DOM needed).
// alphaDecay=0.03 converges at ~222 ticks; 300 gives comfortable headroom.
function runSimulationSync(nodes: GraphNode[], edges: GraphEdge[]): void {
  type N = GraphNode & { index?: number; vx?: number; vy?: number; fx?: number | null; fy?: number | null }
  const links = edges.map((e) => ({ source: e.a, target: e.b, weight: e.weight }))

  forceSimulation<N>(nodes as N[])
    .force(
      "link",
      forceLink<N, typeof links[number]>(links)
        .id((_, i) => i)
        .distance((d) => 40 / Math.max(1, Math.sqrt(d.weight)))
        .strength((d) => Math.min(0.8, 0.2 + 0.15 * d.weight))
    )
    .force("charge", forceManyBody<N>().strength(-30))
    .force("center", forceCenter<N>(W / 2, H / 2))
    .force("x", forceX<N>(W / 2).strength(0.04))
    .force("y", forceY<N>(H / 2).strength(0.04))
    .force("collide", forceCollide<N>(11))
    .stop()
    .tick(300)
}

export async function getBuiltGraph(options?: { bypassCache?: boolean }): Promise<BuiltGraph> {
  const posts = await getPosts()
  const hash = computePostsHash(posts)
  const key = keys.builtGraph(hash)

  const build = async (): Promise<BuiltGraph> => {
    const notionGraph = await getNotionGraph(
      options?.bypassCache ? { bypassCache: true } : undefined
    )
    const { nodes, edges, cats, catCenters } = buildGraph(notionGraph, W, H)
    runSimulationSync(nodes, edges)
    return { nodes, edges, cats, catCenters, generatedAt: notionGraph.generatedAt }
  }

  if (options?.bypassCache) {
    const fresh = await build()
    await cacheStore.set(key, fresh, BUILT_GRAPH_TTL_MS)
    return fresh
  }

  return cacheStore.getOrSet(key, BUILT_GRAPH_TTL_MS, build)
}
