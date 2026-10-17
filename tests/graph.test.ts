import {
  buildGraph,
  graphDisplayColor,
  nodeCollisionRadiusForDegree,
  nodeRadiusForDegree,
} from "src/libs/utils/graph"
import type { NotionGraph } from "src/types/notionGraph"

const graph: NotionGraph = {
  version: "v1",
  generatedAt: "2026-08-09T00:00:00.000Z",
  nodes: [
    {
      kind: "post",
      id: "post-a",
      slug: "post-a",
      title: "Post A",
      category: "notes",
      tags: ["tag-a", "tag-b", "tag-c"],
      readTime: 40,
    },
    { kind: "tag", id: "tag-a", title: "tag-a" },
    { kind: "tag", id: "tag-b", title: "tag-b" },
    { kind: "tag", id: "tag-c", title: "tag-c" },
    { kind: "series", id: "series-a", title: "series-a" },
  ],
  edges: [
    { source: "post-a", target: "tag-a", type: "has-tag", weight: 1 },
    { source: "post-a", target: "tag-b", type: "has-tag", weight: 1 },
    { source: "post-a", target: "tag-c", type: "has-tag", weight: 1 },
    { source: "post-a", target: "series-a", type: "in-series", weight: 1 },
    { source: "post-a", target: "missing-node", type: "link", weight: 1 },
  ],
}

describe("nodeRadiusForDegree", () => {
  it("dramatically differentiates sparse nodes from high-degree hubs", () => {
    expect(nodeRadiusForDegree(0)).toBe(5)
    expect(nodeRadiusForDegree(1)).toBeCloseTo(8.25)
    expect(nodeRadiusForDegree(4)).toBeCloseTo(14.852)
    expect(nodeRadiusForDegree(8)).toBeCloseTo(22.154)
    expect(nodeRadiusForDegree(19)).toBeCloseTo(39.268)
    expect(nodeRadiusForDegree(22)).toBeLessThan(44)
    expect(nodeRadiusForDegree(23)).toBe(44)
    expect(nodeRadiusForDegree(-5)).toBe(nodeRadiusForDegree(0))
    expect(nodeRadiusForDegree(Number.NaN)).toBe(nodeRadiusForDegree(0))
    expect(nodeRadiusForDegree(Number.POSITIVE_INFINITY)).toBe(nodeRadiusForDegree(0))
    expect(nodeRadiusForDegree(Number.NEGATIVE_INFINITY)).toBe(nodeRadiusForDegree(0))

    for (let degree = 0; degree <= 60; degree += 1) {
      expect(nodeRadiusForDegree(degree + 1)).toBeGreaterThanOrEqual(nodeRadiusForDegree(degree))
    }
  })

  it("reserves enough collision space for a selected-node ring", () => {
    expect(nodeCollisionRadiusForDegree(4)).toBeGreaterThan(nodeRadiusForDegree(4))
    expect(nodeCollisionRadiusForDegree(10_000)).toBe(nodeRadiusForDegree(10_000) + 5)
  })
})

describe("graphDisplayColor", () => {
  it("brightens only post ink in dark themes without changing stored colors", () => {
    const { nodes } = buildGraph(graph)
    for (const node of nodes) {
      const storedColor = node.color
      expect(graphDisplayColor(node, false)).toBe(storedColor)
      expect(graphDisplayColor(node, true)).toBe(node.kind === "post" ? "#b8b8b8" : storedColor)
      expect(node.color).toBe(storedColor)
    }
  })
})

describe("buildGraph palette", () => {
  const mixedCategories: NotionGraph = {
    ...graph,
    nodes: [
      ...graph.nodes,
      { kind: "post", id: "post-b", slug: "post-b", title: "Post B", category: "guides", tags: [], readTime: 1 },
      { kind: "post", id: "post-c", slug: "post-c", title: "Post C", category: "notes", tags: [], readTime: 1 },
    ],
    edges: [
      ...graph.edges,
      { source: "post-a", target: "post-b", type: "link", weight: 1 },
      { source: "post-a", target: "post-c", type: "link", weight: 1 },
    ],
  }

  it("uses neutral posts and the same vivid green for tags and series regardless of category order", () => {
    for (const source of [mixedCategories, { ...mixedCategories, nodes: [...mixedCategories.nodes].reverse() }]) {
      const { nodes } = buildGraph(source)
      expect(nodes.filter((node) => node.kind === "post").map((node) => node.color)).toEqual([
        "#5c5c5c", "#5c5c5c", "#5c5c5c",
      ])
      expect(nodes.filter((node) => node.kind !== "post").map((node) => node.color)).toEqual([
        "#18b94f", "#18b94f", "#18b94f", "#18b94f",
      ])
    }
  })

  it("preserves post categories, category centers, and same-category edge metadata for filtering", () => {
    const { nodes, edges, cats, catCenters } = buildGraph(mixedCategories)
    expect(cats).toEqual(["notes", "guides"])
    expect(Object.keys(catCenters)).toEqual(cats)
    expect(nodes.filter((node) => node.kind === "post").map((node) => node.category)).toEqual([
      "notes", "guides", "notes",
    ])
    expect(edges.filter((edge) => edge.type === "link").map((edge) => edge.sameCategory)).toEqual([false, true])
  })
})

describe("buildGraph degree", () => {
  it("counts only visible incident edges for every node kind", () => {
    const { nodes, edges } = buildGraph(graph)

    expect(edges).toHaveLength(4)
    expect(nodes.map((node) => [node.id, node.degree])).toEqual([
      ["post-a", 4],
      ["tag-a", 1],
      ["tag-b", 1],
      ["tag-c", 1],
      ["series-a", 1],
    ])
  })

  it("keeps equal-degree node sizes independent of read time", () => {
    const shortReadGraph: NotionGraph = {
      ...graph,
      nodes: graph.nodes.map((node) =>
        node.kind === "post" ? { ...node, readTime: 1 } : node
      ),
    }
    const longReadPost = buildGraph(graph).nodes[0]
    const shortReadPost = buildGraph(shortReadGraph).nodes[0]

    expect(longReadPost.degree).toBe(shortReadPost.degree)
    expect(nodeRadiusForDegree(longReadPost.degree)).toBe(nodeRadiusForDegree(shortReadPost.degree))
  })
})
