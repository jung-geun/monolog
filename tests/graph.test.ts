import {
  buildGraph,
  nodeCollisionRadiusForDegree,
  nodeRadiusForDegree,
  nodeShapeForKind,
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

describe("nodeShapeForKind", () => {
  it("maps each node kind to its canvas shape", () => {
    expect(nodeShapeForKind("post")).toBe("circle")
    expect(nodeShapeForKind("tag")).toBe("filled-diamond")
    expect(nodeShapeForKind("series")).toBe("outline-diamond")
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
