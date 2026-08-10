import {
  diamondPath,
  getPostEgoGraph,
  type GraphEdge,
  type GraphNode,
} from "src/libs/utils/graph"

const node = (overrides: Partial<GraphNode> = {}): GraphNode => ({
  kind: "post",
  id: "center-id",
  title: "Center",
  slug: "center",
  degree: 0,
  x: 0,
  y: 0,
  color: "#c2410c",
  ...overrides,
})

const edge = (overrides: Partial<GraphEdge> = {}): GraphEdge => ({
  a: 0,
  b: 1,
  type: "link",
  weight: 1,
  sameCategory: false,
  ...overrides,
})

describe("getPostEgoGraph", () => {
  const nodes: GraphNode[] = [
    node(),
    node({ kind: "tag", id: "tag-a", title: "tag-a", degree: 2, color: "#2e8b57" }),
    node({ kind: "series", id: "series-a", title: "Series A", degree: 1, color: "#8e44ad" }),
    node({ id: "incoming-post", title: "Incoming post", slug: "incoming-post", degree: 1 }),
    node({ kind: "tag", id: "shared-tag", title: "shared-tag", degree: 2, color: "#2e8b57" }),
    node({ id: "two-hop-post", title: "Two hop post", slug: "two-hop-post", degree: 1 }),
    { ...node({ id: "unknown-kind", title: "Unknown kind" }), kind: "category" as GraphNode["kind"] },
  ]

  it("matches only the exact post ID", () => {
    expect(getPostEgoGraph(nodes, [], "center")).toBeNull()
    expect(getPostEgoGraph(nodes, [], "Center")).toBeNull()
    expect(getPostEgoGraph(nodes, [], "center-id")).toEqual({ center: nodes[0], neighbors: [] })
  })

  it("collects incoming and outgoing direct neighbors without inferring two-hop posts", () => {
    const graph = getPostEgoGraph(nodes, [
      edge({ a: 0, b: 1, type: "has-tag" }),
      edge({ a: 2, b: 0, type: "in-series" }),
      edge({ a: 3, b: 0, type: "mention" }),
      edge({ a: 0, b: 4, type: "has-tag" }),
      edge({ a: 4, b: 5, type: "has-tag" }),
    ], "center-id")

    expect(graph?.neighbors.map(({ node: neighbor }) => neighbor.id)).toEqual([
      "tag-a",
      "series-a",
      "incoming-post",
      "shared-tag",
    ])
    expect(graph?.neighbors.map(({ node: neighbor }) => neighbor.id)).not.toContain("two-hop-post")
    expect(graph?.neighbors.map(({ totalWeight }) => totalWeight)).toEqual([1, 1, 1, 1])
  })

  it("consolidates duplicate edges and retains their metadata while summing only positive finite weights", () => {
    const first = edge({ a: 3, b: 0, type: "link", weight: 4 })
    const second = edge({ a: 0, b: 3, type: "mention", weight: 2 })
    const zero = edge({ a: 0, b: 3, type: "link_to_page", weight: 0 })
    const negative = edge({ a: 3, b: 0, type: "link", weight: -1 })
    const nonFinite = edge({ a: 0, b: 3, type: "mention", weight: Number.NaN })

    const graph = getPostEgoGraph(nodes, [first, second, zero, negative, nonFinite], "center-id")
    const neighbor = graph?.neighbors[0]

    expect(graph?.neighbors).toHaveLength(1)
    expect(neighbor).toEqual({
      node: nodes[3],
      edges: [first, second, zero, negative, nonFinite],
      totalWeight: 6,
    })
  })

  it("ignores unrelated, self-loop, malformed, out-of-range, and unknown-kind edges", () => {
    const graph = getPostEgoGraph(nodes, [
      edge({ a: 1, b: 2 }),
      edge({ a: 0, b: 0 }),
      edge({ a: 0.5, b: 1 }),
      edge({ a: -1, b: 1 }),
      edge({ a: 0, b: 99 }),
      edge({ a: 0, b: 6 }),
    ], "center-id")

    expect(graph).toEqual({ center: nodes[0], neighbors: [] })
  })

  it("returns null for a missing center and an empty neighbor list for an isolated center", () => {
    expect(getPostEgoGraph(nodes, [], "missing")).toBeNull()
    expect(getPostEgoGraph(nodes, [edge({ a: 1, b: 2 })], "center-id")).toEqual({
      center: nodes[0],
      neighbors: [],
    })
  })
})

describe("diamondPath", () => {
  it("preserves the full graph diamond geometry", () => {
    expect(diamondPath(10, 20, 5)).toBe("M 10 15 L 15 20 L 10 25 L 5 20 Z")
  })
})
