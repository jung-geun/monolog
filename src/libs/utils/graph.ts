import { EdgeKind, NotionGraph } from "src/types/notionGraph"

export type GraphNode = {
  slug: string
  title: string
  category: string
  tags: string[]
  readTime: number
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

export type GraphEdge = {
  a: number
  b: number
  type: EdgeKind
  weight: number
  sameCategory: boolean
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

const seed = (n: number) => ((n * 9301 + 49297) % 233280) / 233280

export const colorForCategory = (cat: string, allCats: string[]): string => {
  const idx = allCats.indexOf(cat)
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
  const cats = Array.from(new Set(graph.nodes.map((n) => n.category)))

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
    const cat = n.category
    return {
      slug: n.slug,
      title: n.title,
      category: cat,
      tags: n.tags,
      readTime: n.readTime,
      x: width / 2 + (seed(i * 2) - 0.5) * 200,
      y: height / 2 + (seed(i * 2 + 1) - 0.5) * 200,
      color: colorForCategory(cat, cats),
    }
  })

  const idToIdx = new Map(graph.nodes.map((n, i) => [n.id, i]))

  const edges: GraphEdge[] = graph.edges.flatMap((e) => {
    const a = idToIdx.get(e.source)
    const b = idToIdx.get(e.target)
    if (a == null || b == null) return []
    return [
      {
        a,
        b,
        type: e.type,
        weight: e.weight,
        sameCategory: nodes[a].category === nodes[b].category,
      },
    ]
  })

  return { nodes, edges, cats, catCenters }
}
