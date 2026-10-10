import type { GraphEdge, GraphNode } from "src/libs/utils/graph"
import type { EdgeKind } from "src/types/notionGraph"
import type { SemanticRelationKind } from "src/types/ontology"

export type RelationKind = EdgeKind | SemanticRelationKind

export type SceneLink = {
  a: number
  b: number
  kind: RelationKind
  weight: number
  confidence?: number
  rationale?: string
  contexts?: string[]
}

export type GraphNode3D = GraphNode & {
  z: number
  vz?: number
  fz?: number | null
}

export type GraphLayoutOptions = {
  postRepulsion: number
  hubRepulsion: number
  hubRingRadius: number
  hubLinkStrength: number
  linkDistance: number
}

export const DEFAULT_LAYOUT: GraphLayoutOptions = {
  postRepulsion: 220,
  hubRepulsion: 30,
  hubRingRadius: 0.42,
  hubLinkStrength: 0.04,
  linkDistance: 44,
}

export const RELATION_STYLES: Record<RelationKind, { label: string; color: string; dashed?: boolean }> = {
  mention: { label: "Mentions", color: "#cc784c" },
  link: { label: "References", color: "#557f9f" },
  link_to_page: { label: "Page link", color: "#557f9f" },
  "has-tag": { label: "Tagged with", color: "#2e8b57" },
  "in-series": { label: "In series", color: "#8e44ad" },
  elaborates: { label: "Elaborates", color: "#6ea8fe", dashed: true },
  supports: { label: "Supports", color: "#57b98d", dashed: true },
  applies: { label: "Applies", color: "#c89747", dashed: true },
  prerequisite: { label: "Prerequisite", color: "#ee5a1c", dashed: true },
  contradicts: { label: "Contradicts", color: "#d45c5c", dashed: true },
  "similar-topic": { label: "Similar topic", color: "#8b899c", dashed: true },
}

export const graphNodeRadius = (degree: number): number =>
  4.5 + Math.min(13.5, Math.sqrt(Math.max(0, degree)) * 1.6)

export type GraphSceneProps = {
  nodes: GraphNode[]
  edges: GraphEdge[]
  links: SceneLink[]
  layoutOptions: GraphLayoutOptions
  selectedIndex: number
  hoveredIndex: number
  focusNeighbors: Set<number> | null
  highlightedCategory: string | null
  neighborhoodOnly: boolean
  nodeAppearRank: number[]
  revealCount: number | null
  resetViewToken: number
  focusRequest: { index: number; token: number } | null
  onSelect: (index: number) => void
  onHover: (index: number) => void
}
