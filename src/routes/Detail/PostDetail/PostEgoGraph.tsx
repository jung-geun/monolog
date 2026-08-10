import { useMemo, useState } from "react"
import styled from "@emotion/styled"
import useNotionGraphQuery from "src/hooks/useNotionGraphQuery"
import {
  diamondPath,
  getPostEgoGraph,
  SERIES_COLOR,
  TAG_COLOR,
  type PostEgoNeighbor,
} from "src/libs/utils/graph"
import type { TPost } from "src/types"

const GRAPH_SIZE = 204
const GRAPH_PADDING = 12
const NODES_PER_RING = 8
const FIRST_RING_RADIUS = 48
const RING_GAP = 22

type RenderedNeighbor = {
  neighbor: PostEgoNeighbor
  x: number
  y: number
}

type ActiveNode = {
  title: string
  id: string
}

const degreeForSort = (neighbor: PostEgoNeighbor): number =>
  Number.isFinite(neighbor.node.degree) ? neighbor.node.degree : 0

const sortNeighbors = (a: PostEgoNeighbor, b: PostEgoNeighbor): number =>
  b.totalWeight - a.totalWeight ||
  degreeForSort(b) - degreeForSort(a) ||
  a.node.title.localeCompare(b.node.title) ||
  a.node.id.localeCompare(b.node.id)

const relationshipNames = (neighbor: PostEgoNeighbor): string[] =>
  [...new Set(neighbor.edges.map((edge) => edge.type))]

const graphSizeFor = (neighborCount: number): number => {
  const ringCount = Math.ceil(neighborCount / NODES_PER_RING)
  const outerRadius = FIRST_RING_RADIUS + Math.max(ringCount - 1, 0) * RING_GAP
  return Math.max(GRAPH_SIZE, (outerRadius + GRAPH_PADDING) * 2)
}

const arrangeNeighbors = (
  neighbors: PostEgoNeighbor[],
  graphSize: number
): RenderedNeighbor[] => {
  const arranged: RenderedNeighbor[] = []
  const center = graphSize / 2
  let offset = 0

  for (let ring = 0; offset < neighbors.length; ring += 1) {
    const ringCount = Math.min(NODES_PER_RING, neighbors.length - offset)
    const radius = FIRST_RING_RADIUS + ring * RING_GAP

    for (let index = 0; index < ringCount; index += 1) {
      const angle = -Math.PI / 2 + (index / ringCount) * Math.PI * 2
      arranged.push({
        neighbor: neighbors[offset + index],
        x: center + Math.cos(angle) * radius,
        y: center + Math.sin(angle) * radius,
      })
    }

    offset += ringCount
  }

  return arranged
}

const PostEgoGraph = ({ post }: { post: TPost }) => {
  const [hoveredNode, setHoveredNode] = useState<ActiveNode | null>(null)
  const [focusedNode, setFocusedNode] = useState<ActiveNode | null>(null)
  const activeNode = hoveredNode ?? focusedNode
  const graph = useNotionGraphQuery()
  const egoGraph = useMemo(
    () => getPostEgoGraph(graph.nodes, graph.edges, post.id),
    [graph.edges, graph.nodes, post.id]
  )

  if (!egoGraph || egoGraph.neighbors.length === 0) return null

  const graphSize = graphSizeFor(egoGraph.neighbors.length)
  const center = graphSize / 2
  const neighbors = arrangeNeighbors([...egoGraph.neighbors].sort(sortNeighbors), graphSize)

  const renderNeighbor = ({ neighbor, x, y }: RenderedNeighbor) => {
    const { node } = neighbor
    const names = relationshipNames(neighbor)
    const description = `${node.title}: ${names.join(", ")}`
    const href = node.kind === "post"
      ? node.slug ? `/${node.slug}` : undefined
      : node.kind === "tag"
        ? `/?tag=${encodeURIComponent(node.title)}`
        : `/series/${encodeURIComponent(node.title)}`
    const radius = node.kind === "post"
      ? Math.min(6, 4 + Math.floor(Math.sqrt(Math.max(node.degree, 0)) / 3))
      : 4
    const shape = node.kind === "post" ? (
      <circle className="graph-node" cx={x} cy={y} r={radius} fill={node.color} />
    ) : node.kind === "tag" ? (
      <path className="graph-node" d={diamondPath(x, y, radius + 1)} fill={TAG_COLOR} />
    ) : (
      <path
        className="graph-node"
        d={diamondPath(x, y, radius + 1)}
        fill="none"
        stroke={SERIES_COLOR}
        strokeWidth={1.5}
      />
    )
    const content = (
      <>
        <title>{node.title}</title>
        <circle className="graph-hit-target" cx={x} cy={y} r={10} />
        {shape}
      </>
    )

    return (
      <g key={node.id} className="graph-neighbor" data-kind={node.kind}>
        <line
          x1={center}
          y1={center}
          x2={x}
          y2={y}
          className="graph-edge"
        />
        {href ? (
          <a
            className="graph-link"
            href={href}
            aria-label={description}
            onMouseEnter={() => setHoveredNode({ id: node.id, title: node.title })}
            onMouseLeave={() => setHoveredNode((current) => current?.id === node.id ? null : current)}
            onFocus={() => setFocusedNode({ id: node.id, title: node.title })}
            onBlur={() => setFocusedNode((current) => current?.id === node.id ? null : current)}
          >
            {content}
          </a>
        ) : (
          <g
            className="graph-static-node"
            aria-label={description}
            onMouseEnter={() => setHoveredNode({ id: node.id, title: node.title })}
            onMouseLeave={() => setHoveredNode((current) => current?.id === node.id ? null : current)}
          >
            {content}
          </g>
        )}
      </g>
    )
  }

  return (
    <StyledSection className="section graph-section" aria-labelledby="post-graph-title">
      <div id="post-graph-title" className="section-label">graph</div>
      <div className="graph-canvas">
        <svg
          aria-label={`${post.title} direct graph`}
          viewBox={`0 0 ${graphSize} ${graphSize}`}
          width={GRAPH_SIZE}
          height={GRAPH_SIZE}
        >
          <title>{post.title}</title>
          {neighbors.map(renderNeighbor)}
          <circle className="graph-center" cx={center} cy={center} r={6} />
        </svg>
        {activeNode && (
          <div className="graph-tooltip" role="tooltip">
            {activeNode.title}
          </div>
        )}
      </div>
    </StyledSection>
  )
}

export default PostEgoGraph

const StyledSection = styled.section`
  .graph-canvas {
    position: relative;
    border: 1px solid ${({ theme }) => theme.colors.editor.line};
    background: ${({ theme }) => theme.colors.editor.bg};
    overflow: hidden;

    --graph-line: ${({ theme }) => theme.colors.editor.line2};
    --graph-accent: ${({ theme }) => theme.colors.editor.accent};
  }

  svg {
    display: block;
    max-width: 100%;
  }

  .graph-edge {
    stroke: var(--graph-line);
    stroke-width: 1px;
    opacity: 0.72;
  }

  .graph-center {
    fill: var(--graph-accent);
    stroke: ${({ theme }) => theme.colors.editor.bg};
    stroke-width: 2px;
  }

  .graph-hit-target {
    fill: transparent;
  }

  .graph-tooltip {
    position: absolute;
    top: 7px;
    right: 7px;
    left: 7px;
    z-index: 1;
    overflow: hidden;
    padding: 3px 5px;
    border: 1px solid ${({ theme }) => theme.colors.editor.line};
    background: ${({ theme }) => theme.colors.editor.bg2};
    color: ${({ theme }) => theme.colors.editor.fg};
    font-size: 10px;
    line-height: 1.3;
    pointer-events: none;
    text-align: center;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .graph-link,
  .graph-node {
    transition: fill 0.15s ease, stroke 0.15s ease, opacity 0.15s ease;
  }

  .graph-link:hover .graph-node,
  .graph-link:focus-visible .graph-node {
    stroke: var(--graph-accent);
    stroke-width: 2px;
  }

  .graph-link:focus-visible {
    outline: 1px solid var(--graph-accent);
    outline-offset: 2px;
  }

  @media (prefers-reduced-motion: reduce) {
    .graph-link,
    .graph-node {
      transition: none;
    }
  }
`
