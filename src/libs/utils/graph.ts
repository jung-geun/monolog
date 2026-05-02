import { TPost } from "src/types"

export type GraphNode = {
  slug: string
  title: string
  category: string
  tags: string[]
  readTime: number
  x: number
  y: number
  color: string
}

export type GraphEdge = {
  a: number
  b: number
  sharedTags: number
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
  posts: TPost[],
  width = 720,
  height = 520
): {
  nodes: GraphNode[]
  edges: GraphEdge[]
  cats: string[]
  catCenters: Record<string, { x: number; y: number }>
} => {
  const cats = Array.from(new Set(posts.map((p) => p.category?.[0] || "misc")))

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

  // Tighter node spread inside each cluster so groups read as groups.
  const nodes: GraphNode[] = posts.map((p, i) => {
    const cat = p.category?.[0] || "misc"
    const c = catCenters[cat] || { x: width / 2, y: height / 2 }
    const r = 12 + seed(i + 1) * 38
    const a = seed(i + 17) * Math.PI * 2
    return {
      slug: p.slug,
      title: p.title,
      category: cat,
      tags: p.tags || [],
      readTime: 8,
      x: c.x + Math.cos(a) * r,
      y: c.y + Math.sin(a) * r,
      color: colorForCategory(cat, cats),
    }
  })

  const edges: GraphEdge[] = []
  for (let i = 0; i < nodes.length; i++) {
    for (let j = i + 1; j < nodes.length; j++) {
      const shared = nodes[i].tags.filter((t) => nodes[j].tags.includes(t)).length
      if (shared > 0) {
        edges.push({
          a: i,
          b: j,
          sharedTags: shared,
          sameCategory: nodes[i].category === nodes[j].category,
        })
      }
    }
  }

  return { nodes, edges, cats, catCenters }
}
