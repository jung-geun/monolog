import { EdgeKind, NotionGraph } from "src/types/notionGraph"

export type GraphNode = {
  kind: "post" | "tag" | "series"
  id: string
  title: string
  // post-only
  slug?: string
  category?: string
  tags?: string[]
  readTime?: number
  url?: string
  createdAt?: string
  // computed
  degree: number
  x: number
  y: number
  color: string
  // d3-force simulation fields (mutated by simulation)
  vx?: number
  vy?: number
  fx?: number | null
  fy?: number | null
  index?: number
}

export type GraphNodeShape = "circle" | "filled-diamond" | "outline-diamond"

export function nodeShapeForKind(kind: GraphNode["kind"]): GraphNodeShape {
  switch (kind) {
    case "post":
      return "circle"
    case "tag":
      return "filled-diamond"
    case "series":
      return "outline-diamond"
  }
}

export type GraphEdge = {
  a: number
  b: number
  type: EdgeKind
  weight: number
  sameCategory: boolean
}

export type PostEgoNeighbor = {
  node: GraphNode
  edges: GraphEdge[]
  totalWeight: number
}

export type PostEgoGraph = {
  center: GraphNode
  neighbors: PostEgoNeighbor[]
}

const isGraphNodeKind = (kind: unknown): kind is GraphNode["kind"] =>
  kind === "post" || kind === "tag" || kind === "series"

export const diamondPath = (x: number, y: number, radius: number): string =>
  `M ${x} ${y - radius} L ${x + radius} ${y} L ${x} ${y + radius} L ${x - radius} ${y} Z`

export const getPostEgoGraph = (
  nodes: GraphNode[],
  edges: GraphEdge[],
  postId: string
): PostEgoGraph | null => {
  const centerIndex = nodes.findIndex(
    (node) => node?.kind === "post" && node.id === postId
  )
  if (centerIndex < 0) return null

  const center = nodes[centerIndex]
  const neighbors = new Map<string, PostEgoNeighbor>()

  for (const edge of edges) {
    if (
      !Number.isInteger(edge.a) ||
      !Number.isInteger(edge.b) ||
      edge.a < 0 ||
      edge.b < 0 ||
      edge.a >= nodes.length ||
      edge.b >= nodes.length ||
      edge.a === edge.b
    ) {
      continue
    }

    const oppositeIndex = edge.a === centerIndex
      ? edge.b
      : edge.b === centerIndex
        ? edge.a
        : null
    if (oppositeIndex == null) continue

    const opposite = nodes[oppositeIndex]
    if (
      !opposite ||
      !isGraphNodeKind(opposite.kind) ||
      typeof opposite.id !== "string"
    ) {
      continue
    }

    const existing = neighbors.get(opposite.id)
    const totalWeight = Number.isFinite(edge.weight) && edge.weight > 0
      ? edge.weight
      : 0
    if (existing) {
      existing.edges.push(edge)
      existing.totalWeight += totalWeight
    } else {
      neighbors.set(opposite.id, {
        node: opposite,
        edges: [edge],
        totalWeight,
      })
    }
  }

  return { center, neighbors: [...neighbors.values()] }
}

// Limited palette tuned to the editor theme (warm earth + muted accents).
const PALETTE = [
  "#ee5a1c", // accent (orange)
  "#5a9aaf", // teal
  "#8da874", // moss
  "#b56fa3", // mauve
  "#c4a45a", // mustard
  "#7a6dba", // periwinkle
  "#d77c6f", // coral
  "#6fa8c4", // sky
]

export const TAG_COLOR = "#2e8b57"    // Sea green — post 팔레트(moss #8da874)와 충돌 없는 짙은 녹색
export const SERIES_COLOR = "#8e44ad" // Wisteria — 짙은 보라, post 팔레트(mauve/periwinkle)와 명확히 구분

const MIN_NODE_RADIUS = 5
const MAX_NODE_RADIUS = 44
const DEGREE_RADIUS_FACTOR = 3.25
const DEGREE_RADIUS_EXPONENT = 0.8
const NODE_RING_GAP = 5
export const NODE_LABEL_GAP = 4

export const nodeRadiusForDegree = (degree: number): number => {
  const normalizedDegree = Number.isFinite(degree) ? Math.max(degree, 0) : 0
  return Math.min(
    MAX_NODE_RADIUS,
    MIN_NODE_RADIUS + Math.pow(normalizedDegree, DEGREE_RADIUS_EXPONENT) * DEGREE_RADIUS_FACTOR
  )
}

export const nodeCollisionRadiusForDegree = (degree: number): number =>
  nodeRadiusForDegree(degree) + NODE_RING_GAP

const seed = (n: number) => ((n * 9301 + 49297) % 233280) / 233280

export const colorForNode = (node: { kind: string; category?: string }, allCats: string[]): string => {
  if (node.kind === "tag") return TAG_COLOR
  if (node.kind === "series") return SERIES_COLOR
  const idx = allCats.indexOf(node.category ?? "")
  if (idx < 0) return PALETTE[0]
  return PALETTE[idx % PALETTE.length]
}

export const buildGraph = (
  graph: NotionGraph,
  width = 720,
  height = 520
): {
  nodes: GraphNode[]
  edges: GraphEdge[]
  cats: string[]
  catCenters: Record<string, { x: number; y: number }>
} => {
  // cats는 post 노드만 기준 — tag/series가 cluster label·filter chip에 새지 않도록
  const cats = Array.from(
    new Set(
      graph.nodes.filter((n) => n.kind === "post").map((n) => (n as any).category as string)
    )
  )

  // Cluster centers placed on a circle, with a tighter radius so labels stay inside.
  const clusterRadius = Math.min(width, height) * 0.32
  const catCenters: Record<string, { x: number; y: number }> = {}
  cats.forEach((c, i) => {
    const ang = (i / Math.max(cats.length, 1)) * Math.PI * 2 - Math.PI / 2
    catCenters[c] = {
      x: width / 2 + Math.cos(ang) * clusterRadius,
      y: height / 2 + Math.sin(ang) * clusterRadius,
    }
  })

  // Initial positions: small random spread near centre — force simulation will settle from here.
  const nodes: GraphNode[] = graph.nodes.map((n, i) => {
    const base = {
      kind: n.kind,
      id: n.id,
      title: n.title,
      degree: 0,
      x: width / 2 + (seed(i * 2) - 0.5) * 200,
      y: height / 2 + (seed(i * 2 + 1) - 0.5) * 200,
      color: colorForNode(n, cats),
    }
    if (n.kind === "post") {
      return {
        ...base,
        slug: n.slug,
        category: n.category,
        tags: n.tags,
        readTime: n.readTime,
        url: n.url,
        createdAt: n.createdAt,
      }
    }
    return base
  })

  const idToIdx = new Map(graph.nodes.map((n, i) => [n.id, i]))
  const edges: GraphEdge[] = graph.edges.flatMap((e) => {
    const a = idToIdx.get(e.source)
    const b = idToIdx.get(e.target)
    if (a == null || b == null) return []
    const na = nodes[a], nb = nodes[b]
    const sameCategory =
      na.kind === "post" && nb.kind === "post" && na.category === nb.category
    return [{ a, b, type: e.type, weight: e.weight, sameCategory }]
  })

  for (const edge of edges) {
    nodes[edge.a].degree += 1
    nodes[edge.b].degree += 1
  }

  return { nodes, edges, cats, catCenters }
}
