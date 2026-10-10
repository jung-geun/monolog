import {
  forceCollide,
  forceLink,
  forceManyBody,
  forceRadial,
  forceSimulation,
  forceX,
  forceY,
  forceZ,
} from "d3-force-3d"
import type { SimulationLinkDatum } from "d3-force-3d"
import type { GraphEdge, GraphNode } from "src/libs/utils/graph"
import { graphNodeRadius } from "./types"
import type { GraphLayoutOptions, GraphNode3D } from "./types"

type Position3D = { x: number; y: number; z: number }
type LayoutLink = SimulationLinkDatum<GraphNode3D> & {
  a: number
  b: number
  weight: number
  hub: boolean
}

export type Graph3DLayout = {
  nodes: GraphNode3D[]
  /** Advance from the scene's RAF; false means that another layout frame is unnecessary. */
  tick(iterations?: number): boolean
  updateOptions(options: GraphLayoutOptions): void
  /** A null position releases all three axes after dragging. */
  pin(index: number, position: Position3D | null): void
  stop(): void
}

const GOLDEN_ANGLE = Math.PI * (3 - Math.sqrt(5))
const SPHERE_OFFSET = (3 - Math.sqrt(5)) / 2
const COLLISION_PADDING = 2.5
const REST_SPEED_SQUARED = 0.0025

/**
 * Origin-centred world units match graphNodeRadius. Categories only supply weak
 * 3D anchors: real graph edges, not category membership, supply the strong springs.
 * Uncategorised posts and isolated hubs use their connected component instead.
 */
export function createGraph3DLayout(
  sourceNodes: GraphNode[],
  edges: GraphEdge[],
  options: GraphLayoutOptions
): Graph3DLayout {
  const count = sourceNodes.length
  const radii = new Float64Array(count)
  const parent = new Int32Array(count)
  let radiusSum = 0
  for (let i = 0; i < count; i++) {
    parent[i] = i
    radii[i] = graphNodeRadius(sourceNodes[i].degree) + COLLISION_PADDING
    radiusSum += radii[i]
  }
  const component = (index: number): number => {
    let root = index
    while (parent[root] !== root) root = parent[root]
    while (parent[index] !== index) {
      const next = parent[index]
      parent[index] = root
      index = next
    }
    return root
  }
  const links: LayoutLink[] = edges.map((edge) => {
    const aRoot = component(edge.a)
    const bRoot = component(edge.b)
    if (aRoot !== bRoot) parent[Math.max(aRoot, bRoot)] = Math.min(aRoot, bRoot)
    return {
      source: edge.a,
      target: edge.b,
      a: edge.a,
      b: edge.b,
      weight: Math.max(1, edge.weight),
      hub: sourceNodes[edge.a].kind !== "post" || sourceNodes[edge.b].kind !== "post",
    }
  })

  // cbrt scaling reflects a volume, rather than the old 2D canvas width/height.
  const averageRadius = count ? radiusSum / count : graphNodeRadius(0) + COLLISION_PADDING
  const extent = Math.max(110, Math.cbrt(count) * averageRadius * 4)
  const groups = new Map<string, number>()
  const groupIndex = new Int32Array(count)
  groupIndex.fill(-1)
  const addGroup = (key: string): number => {
    const existing = groups.get(key)
    if (existing !== undefined) return existing
    const index = groups.size
    groups.set(key, index)
    return index
  }
  for (let i = 0; i < count; i++) {
    const node = sourceNodes[i]
    if (node.kind === "post") {
      groupIndex[i] = addGroup(node.category ? `category:${node.category}` : `community:${component(i)}`)
    }
  }
  const hubNeighborCounts = new Uint32Array(count)
  for (const link of links) {
    if (sourceNodes[link.a].kind !== "post" && sourceNodes[link.b].kind === "post") hubNeighborCounts[link.a]++
    if (sourceNodes[link.b].kind !== "post" && sourceNodes[link.a].kind === "post") hubNeighborCounts[link.b]++
  }
  for (let i = 0; i < count; i++) {
    if (sourceNodes[i].kind !== "post" && hubNeighborCounts[i] === 0) {
      groupIndex[i] = addGroup(`community:${component(i)}`)
    }
  }

  const groupAnchors = new Float64Array(groups.size * 3)
  const anchorRadius = groups.size > 1 ? extent * 0.5 : 0
  for (let i = 0; i < groups.size; i++) {
    const z = 1 - 2 * (i + SPHERE_OFFSET) / groups.size
    const transverse = Math.sqrt(1 - z * z)
    const angle = i * GOLDEN_ANGLE + 0.7
    groupAnchors[i * 3] = Math.cos(angle) * transverse * anchorRadius
    groupAnchors[i * 3 + 1] = Math.sin(angle) * transverse * anchorRadius
    groupAnchors[i * 3 + 2] = z * anchorRadius
  }
  const anchors = new Float64Array(count * 3)
  for (let i = 0; i < count; i++) {
    if (groupIndex[i] < 0) continue
    for (let axis = 0; axis < 3; axis++) anchors[i * 3 + axis] = groupAnchors[groupIndex[i] * 3 + axis]
  }
  // A hub's weak angular preference follows its actual post neighbours, not a
  // synthetic edge or a fixed 2D ring. The radial force below remains spherical.
  for (const link of links) {
    const aIsPost = sourceNodes[link.a].kind === "post"
    const bIsPost = sourceNodes[link.b].kind === "post"
    if (aIsPost === bIsPost) continue
    const hub = aIsPost ? link.b : link.a
    const post = aIsPost ? link.a : link.b
    for (let axis = 0; axis < 3; axis++) {
      anchors[hub * 3 + axis] += anchors[post * 3 + axis] / hubNeighborCounts[hub]
    }
  }

  const nodes: GraphNode3D[] = sourceNodes.map((source, i) => {
    const z = 1 - 2 * (i + SPHERE_OFFSET) / count
    const transverse = Math.sqrt(1 - z * z)
    const angle = i * GOLDEN_ANGLE + 0.7
    const spread = Math.max(24, extent * 0.35) * Math.cbrt((i + 1) / count)
    const node: GraphNode3D = {
      ...source,
      x: anchors[i * 3] + Math.cos(angle) * transverse * spread,
      y: anchors[i * 3 + 1] + Math.sin(angle) * transverse * spread,
      z: anchors[i * 3 + 2] + z * spread,
    }
    // Never inherit an old SVG simulation's velocity, index or drag constraints,
    // including any 3D state left on a caller's runtime object.
    delete node.index
    delete node.vx
    delete node.vy
    delete node.vz
    delete node.fx
    delete node.fy
    delete node.fz
    return node
  })

  const charge = forceManyBody<GraphNode3D>()
    .distanceMin(averageRadius * 2)
    .distanceMax(extent * 3)
  const linkForce = forceLink<GraphNode3D, LayoutLink>(links).id((_, index) => index)
  const shell = forceRadial<GraphNode3D>(extent * options.hubRingRadius * 2, 0, 0, 0)
    .strength((node) => node.kind === "post" ? 0 : 0.045)
  const collision = forceCollide<GraphNode3D>((_, index) => radii[index])
    .strength(1)
    .iterations(3)
  const categoryStrength = (node: GraphNode3D) => node.kind === "post" ? 0.006 : 0.002
  const x = forceX<GraphNode3D>((_, index) => anchors[index * 3]).strength(categoryStrength)
  const y = forceY<GraphNode3D>((_, index) => anchors[index * 3 + 1]).strength(categoryStrength)
  const z = forceZ<GraphNode3D>((_, index) => anchors[index * 3 + 2]).strength(categoryStrength)

  // d3 starts its timer in the constructor. Stop synchronously and NEVER restart:
  // the scene owns the only clock, including option changes and pin release.
  const simulation = forceSimulation<GraphNode3D>(nodes, 3)
    .stop()
    .alphaDecay(0.022)
    .alphaMin(0.001)
    .velocityDecay(0.4)
    .force("link", linkForce)
    .force("charge", charge)
    .force("shell", shell)
    .force("categoryX", x)
    .force("categoryY", y)
    .force("categoryZ", z)
    .force("centerX", forceX<GraphNode3D>(0).strength(0.003))
    .force("centerY", forceY<GraphNode3D>(0).strength(0.003))
    .force("centerZ", forceZ<GraphNode3D>(0).strength(0.003))
    .force("collision", collision)
  let stopped = false
  let settling = count > 0

  const configure = (next: GraphLayoutOptions): void => {
    charge.strength((node) => -(node.kind === "post" ? next.postRepulsion : next.hubRepulsion))
    shell.radius(extent * next.hubRingRadius * 2)
    linkForce
      .distance((link) => {
        const clearance = radii[link.a] + radii[link.b] + 6
        return Math.max(clearance, link.hub ? 100 : next.linkDistance / Math.max(1, Math.log2(1 + link.weight)))
      })
      .strength((link) => link.hub ? next.hubLinkStrength : Math.min(0.6, 0.15 + 0.1 * link.weight))
  }
  const reheat = (alpha: number): void => {
    simulation.alpha(Math.max(simulation.alpha(), alpha))
    settling = count > 0
  }
  configure(options)

  return {
    nodes,
    tick(iterations = 1) {
      if (stopped || !settling) return false
      simulation.tick(iterations)
      let moving = false
      for (const node of nodes) {
        const vx = node.vx ?? 0
        const vy = node.vy ?? 0
        const vz = node.vz ?? 0
        if (vx * vx + vy * vy + vz * vz > REST_SPEED_SQUARED) {
          moving = true
          break
        }
      }
      settling = simulation.alpha() >= simulation.alphaMin() || moving
      return settling
    },
    updateOptions(next) {
      if (stopped) return
      configure(next)
      reheat(0.6)
    },
    pin(index, position) {
      if (stopped) return
      const node = nodes[index]
      if (!node) return
      if (position) {
        node.x = node.fx = position.x
        node.y = node.fy = position.y
        node.z = node.fz = position.z
      } else {
        node.fx = node.fy = node.fz = null
      }
      node.vx = node.vy = node.vz = 0
      reheat(0.45)
    },
    stop() {
      stopped = true
      settling = false
      simulation.stop()
    },
  }
}
