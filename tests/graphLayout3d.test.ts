/**
 * @jest-environment node
 * @jest-environment-options {"customExportConditions":["umd"]}
 */
// Use d3's published UMD exports to exercise the real forces in CommonJS Jest.
import type { GraphEdge, GraphNode } from "src/libs/utils/graph"
import { createGraph3DLayout } from "src/routes/Graph/layout3d"
import type { Graph3DLayout } from "src/routes/Graph/layout3d"
import { DEFAULT_LAYOUT, graphNodeRadius } from "src/routes/Graph/types"
import type { GraphLayoutOptions, GraphNode3D } from "src/routes/Graph/types"

const post = (id: string, overrides: Partial<GraphNode> = {}): GraphNode => ({
  id, title: id, kind: "post", category: "notes", degree: 0,
  x: 0, y: 0, color: "#888", ...overrides,
})
const edge = (a: number, b: number): GraphEdge => ({
  a, b, type: "link", weight: 1, sameCategory: true,
})
const coordinates = (node: GraphNode3D) => [node.x, node.y, node.z]
const distance = (a: GraphNode3D, b: GraphNode3D) =>
  Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z)
const layouts: Graph3DLayout[] = []
const create = (
  nodes: GraphNode[],
  edges: GraphEdge[] = [],
  options: GraphLayoutOptions = DEFAULT_LAYOUT
) => {
  const layout = createGraph3DLayout(nodes, edges, options)
  layouts.push(layout)
  return layout
}

afterEach(() => {
  for (const layout of layouts) layout.stop()
  layouts.length = 0
})

describe("3D semantic-anchor layout", () => {
  it("does not mutate source nodes, embeddings, edges or inherited simulation state", () => {
    const stale: GraphNode3D = {
      ...post("a", { embeddingPosition: [0.1, 0.2, 0.3], degree: 1 }),
      x: 900, y: 800, z: 700, vx: 30, vy: 20, vz: 10,
      fx: 900, fy: 800, fz: 700, index: 40,
    }
    const nodes = [stale, post("b", { degree: 1 })]
    const edges = [edge(0, 1)]
    const before = JSON.parse(JSON.stringify({ nodes, edges }))
    Object.freeze(stale.embeddingPosition)
    nodes.forEach(Object.freeze)
    edges.forEach(Object.freeze)
    Object.freeze(nodes)
    Object.freeze(edges)
    const layout = create(nodes, edges)

    expect(layout.nodes[0]).not.toBe(stale)
    expect(layout.nodes[0].index).toBe(0)
    expect([layout.nodes[0].fx, layout.nodes[0].fy, layout.nodes[0].fz]).toEqual([
      undefined, undefined, undefined,
    ])
    layout.tick(300)
    layout.pin(0, { x: 20, y: 30, z: 40 })
    layout.tick(10)
    layout.pin(0, null)
    layout.updateOptions({ ...DEFAULT_LAYOUT, linkDistance: 70 })
    layout.tick(100)

    expect({ nodes, edges }).toEqual(before)
  })

  it("resolves coincident embedded posts and hubs without relying on charge", () => {
    const nodes = [
      post("a", { embeddingPosition: [0, 0, 0] }),
      post("b", { embeddingPosition: [0, 0, 0] }),
      post("c", { embeddingPosition: [0, 0, 0] }),
      post("pending"),
      post("tag", { kind: "tag" }),
      post("series", { kind: "series" }),
    ]
    const layout = create(nodes, [], {
      ...DEFAULT_LAYOUT, postRepulsion: 0, hubRepulsion: 0, hubRingRadius: 0,
    })
    // Exercise an actual collision, not merely the non-overlapping seed layout.
    for (const node of layout.nodes) node.x = node.y = node.z = 0
    layout.tick(300)

    for (let a = 0; a < nodes.length; a++) {
      for (let b = a + 1; b < nodes.length; b++) {
        expect(distance(layout.nodes[a], layout.nodes[b])).toBeGreaterThan(
          graphNodeRadius(nodes[a].degree) + graphNodeRadius(nodes[b].degree)
        )
      }
    }
  })

  it.each([true, false])("applies adjustable repulsion to posts (embedded: %s)", embedded => {
    const nodes = ["a", "b"].map(id => post(id, embedded ? { embeddingPosition: [0, 0, 0] } : {}))
    const quiet = create(nodes, [], { ...DEFAULT_LAYOUT, postRepulsion: 0 })
    const repelled = create(nodes, [], { ...DEFAULT_LAYOUT, postRepulsion: 0 })
    quiet.tick(300)
    repelled.tick(300)
    repelled.updateOptions({ ...DEFAULT_LAYOUT, postRepulsion: 220 })
    repelled.tick(300)

    expect(distance(repelled.nodes[0], repelled.nodes[1])).toBeGreaterThan(
      distance(quiet.nodes[0], quiet.nodes[1]) + 5
    )
  })

  it("retains semantic neighborhoods without requiring exact runtime PCA coordinates", () => {
    const nodes = [
      post("left-a", { embeddingPosition: [-1, 0, 0] }),
      post("left-b", { embeddingPosition: [-0.9, 0, 0] }),
      post("right-a", { embeddingPosition: [0.9, 0, 0] }),
      post("right-b", { embeddingPosition: [1, 0, 0] }),
    ]
    const layout = create(nodes)
    layout.tick(300)
    const [a, b, c, d] = layout.nodes
    const within = (distance(a, b) + distance(c, d)) / 2
    const between = (distance(a, c) + distance(a, d) + distance(b, c) + distance(b, d)) / 4

    expect(within).toBeLessThan(between)
    expect((a.x + b.x) / 2).toBeLessThan(0)
    expect((c.x + d.x) / 2).toBeGreaterThan(0)
    for (const node of layout.nodes) {
      expect(node.fx == null && node.fy == null && node.fz == null).toBe(true)
    }
  })

  it("keeps linked embedded pairs closer than unrelated nodes", () => {
    const nodes = ["a", "b", "c", "d"].map(id => post(id, {
      degree: 1, embeddingPosition: [0, 0, 0],
    }))
    const layout = create(nodes, [edge(0, 1), edge(2, 3)])
    layout.tick(300)
    const [a, b, c, d] = layout.nodes
    const linked = (distance(a, b) + distance(c, d)) / 2
    const unrelated = (distance(a, c) + distance(a, d) + distance(b, c) + distance(b, d)) / 4

    expect(linked).toBeLessThan(unrelated)
  })

  it.each([true, false])("pins and releases all axes without teleporting (embedded: %s)", embedded => {
    const layout = create([
      post("dragged", embedded ? { embeddingPosition: [0, 0, 0] } : {}),
      post("neighbor"),
    ], [edge(0, 1)])
    layout.tick(300)
    const position = { x: 250, y: -180, z: 140 }
    const node = layout.nodes[0]
    layout.pin(0, position)
    layout.updateOptions({ ...DEFAULT_LAYOUT, linkDistance: 60 })
    layout.tick(40)
    expect(coordinates(node)).toEqual([position.x, position.y, position.z])
    expect([node.fx, node.fy, node.fz]).toEqual(coordinates(node))

    layout.pin(0, null)
    expect([node.fx, node.fy, node.fz]).toEqual([null, null, null])
    expect(coordinates(node)).toEqual([position.x, position.y, position.z])
    layout.tick(150)
    expect(Math.hypot(node.x - position.x, node.y - position.y, node.z - position.z)).toBeGreaterThan(1)
  })

  it("settles a zero-rank embedding into a finite, bounded, deterministic 3D volume", () => {
    const nodes = Array.from({ length: 8 }, (_, i) => post(String(i), {
      embeddingPosition: [0, 0, 0],
    }))
    const first = create(nodes)
    const second = create(nodes)
    first.tick(400)
    second.tick(400)
    expect(first.nodes.map(coordinates)).toEqual(second.nodes.map(coordinates))
    for (const node of first.nodes) {
      expect(coordinates(node).every(Number.isFinite)).toBe(true)
      expect(Math.hypot(node.x, node.y, node.z)).toBeLessThan(880)
    }

    // A nonzero tetrahedron distinguishes real depth from a rotated flat plane.
    const origin = first.nodes[0]
    let maxVolume = 0
    for (let a = 1; a < nodes.length; a++) {
      const u = coordinates(first.nodes[a]).map((value, axis) => value - coordinates(origin)[axis])
      for (let b = a + 1; b < nodes.length; b++) {
        const v = coordinates(first.nodes[b]).map((value, axis) => value - coordinates(origin)[axis])
        for (let c = b + 1; c < nodes.length; c++) {
          const w = coordinates(first.nodes[c]).map((value, axis) => value - coordinates(origin)[axis])
          const volume = Math.abs(
            u[0] * (v[1] * w[2] - v[2] * w[1]) -
            u[1] * (v[0] * w[2] - v[2] * w[0]) +
            u[2] * (v[0] * w[1] - v[1] * w[0])
          )
          maxVolume = Math.max(maxVolume, volume)
        }
      }
    }
    expect(maxVolume).toBeGreaterThan(1)
  })

  it("handles empty and singleton layouts and stops advancing when stopped", () => {
    expect(create([]).tick()).toBe(false)
    const layout = create([post("only", { embeddingPosition: [0, 0, 0] })])
    layout.tick(400)
    expect(coordinates(layout.nodes[0]).every(Number.isFinite)).toBe(true)
    expect(layout.tick()).toBe(false)
    layout.stop()
    const before = coordinates(layout.nodes[0])
    layout.pin(0, { x: 100, y: 200, z: 300 })
    layout.updateOptions({ ...DEFAULT_LAYOUT, postRepulsion: 500 })
    expect(layout.tick(10)).toBe(false)
    expect(coordinates(layout.nodes[0])).toEqual(before)
  })
})
