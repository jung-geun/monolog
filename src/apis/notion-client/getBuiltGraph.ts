import {
  forceSimulation,
  forceLink,
  forceManyBody,
  forceCollide,
  forceX,
  forceY,
  forceRadial,
} from "d3-force"
import { cacheStore, keys } from "src/libs/cache"
import { buildGraph } from "src/libs/utils/graph"
import type { GraphNode, GraphEdge } from "src/libs/utils/graph"
import type { NotionGraph } from "src/types/notionGraph"
import { computePostsGraphHash } from "./graphHash"
import { getPosts } from "./getPosts"
import { getNotionGraph } from "./getNotionGraph"

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


// Run D3 force simulation synchronously to convergence (server-side, no DOM needed).
// alphaDecay=0.03 converges at ~222 ticks; 400 gives headroom for forceRadial settling.
function runSimulationSync(nodes: GraphNode[], edges: GraphEdge[]): void {
  type N = GraphNode & { index?: number; vx?: number; vy?: number; fx?: number | null; fy?: number | null }
  type L = { source: number; target: number; weight: number; type: string; sameCategory: boolean }

  const links: L[] = edges.map((e) => ({
    source: e.a,
    target: e.b,
    weight: e.weight,
    type: e.type,
    sameCategory: e.sameCategory,
  }))

  const isHubLink = (d: L) => d.type === "has-tag" || d.type === "in-series"

  forceSimulation<N>(nodes as N[])
    .force(
      "link",
      forceLink<N, L>(links)
        .id((_, i) => i)
        .distance((d) =>
          isHubLink(d)
            ? 110
            : Math.max(20, 44 / Math.max(1, Math.log2(1 + d.weight)))
        )
        .strength((d) =>
          isHubLink(d)
            ? 0.04
            : Math.min(0.6, 0.15 + 0.1 * d.weight)
        )
    )
    .force("charge", forceManyBody<N>().strength((node) => (node.kind === "post" ? -220 : -30)))
    .force(
      "radial",
      forceRadial<N>(Math.min(W, H) * 0.42, W / 2, H / 2)
        .strength((node) => (node.kind === "post" ? 0 : 0.18))
    )
    .force("x", forceX<N>(W / 2).strength((n) => (n.kind === "post" ? 0.01 : 0)))
    .force("y", forceY<N>(H / 2).strength((n) => (n.kind === "post" ? 0.01 : 0)))
    .force("collide", forceCollide<N>((node) => (node.kind === "post" ? 14 : 7)))
    .stop()
    .tick(400)
}

export async function getBuiltGraph(options?: {
  bypassCache?: boolean
  notionGraph?: NotionGraph
}): Promise<BuiltGraph> {
  const posts = await getPosts()
  const hash = computePostsGraphHash(posts)
  const key = keys.builtGraph(hash)
  let builtFromPartial = false

  const build = async (): Promise<BuiltGraph> => {
    const notionGraph =
      options?.notionGraph ??
      (await getNotionGraph(options?.bypassCache ? { bypassCache: true } : undefined))
    builtFromPartial = notionGraph.partial === true
    const { nodes, edges, cats, catCenters } = buildGraph(notionGraph, W, H)
    runSimulationSync(nodes, edges)
    return { nodes, edges, cats, catCenters, generatedAt: notionGraph.generatedAt }
  }

  if (options?.bypassCache === true) {
    const fresh = await build()
    if (!builtFromPartial) await cacheStore.set(key, fresh, BUILT_GRAPH_TTL_MS)
    return fresh
  }

  return cacheStore.getOrSet(key, BUILT_GRAPH_TTL_MS, build, {
    isCacheable: () => !builtFromPartial,
  })
}
