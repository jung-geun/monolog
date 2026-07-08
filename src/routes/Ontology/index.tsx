import { useEffect, useRef, useState } from "react"
import Link from "next/link"
import styled from "@emotion/styled"
import {
  forceSimulation,
  forceLink,
  forceManyBody,
  forceCenter,
  forceCollide,
  type Simulation,
  SimulationNodeDatum,
  SimulationLinkDatum,
} from "d3-force"
import useOntologyQuery from "src/hooks/useOntologyQuery"
import useNotionGraphQuery from "src/hooks/useNotionGraphQuery"
import { Entity, SemanticEdge, SemanticRelationKind } from "src/types/ontology"

type ViewMode = "entity" | "relation"

type ONode = SimulationNodeDatum & {
  id: string
  kind: "entity" | "post"
  entityKind?: Entity["kind"]
  relKind?: SemanticRelationKind
  label: string
  slug?: string
  postIds?: string[]
  description?: string
}

type OLink = SimulationLinkDatum<ONode> & {
  edgeKind: SemanticRelationKind | "mentions"
  confidence?: number
}

const ENTITY_COLOR: Record<Entity["kind"], string> = {
  concept: "#6ea8fe",
  tech:    "#57cc99",
  person:  "#ffb347",
  work:    "#bf7fff",
}

const EDGE_COLOR: Record<SemanticRelationKind, string> = {
  "similar-topic": "#888",
  elaborates:      "#6ea8fe",
  supports:        "#57cc99",
  applies:         "#ffb347",
  prerequisite:    "#ee5a1c",
  contradicts:     "#e05c5c",
}

const W = 800
const H = 560

function buildEntityGraph(
  ontology: NonNullable<ReturnType<typeof useOntologyQuery>["ontology"]>,
  postMap: Map<string, { id: string; title: string; slug: string }>
): { nodes: ONode[]; links: OLink[] } {
  const nodes: ONode[] = []
  const links: OLink[] = []

  for (const e of ontology.entities) {
    nodes.push({
      id: e.id,
      kind: "entity",
      entityKind: e.kind,
      label: e.name,
      description: e.description,
      postIds: e.postIds,
      x: W / 2 + (Math.random() - 0.5) * 200,
      y: H / 2 + (Math.random() - 0.5) * 200,
    })
  }

  const postSet = new Set<string>()
  for (const e of ontology.entities) {
    for (const pId of e.postIds) {
      if (!postSet.has(pId)) {
        const p = postMap.get(pId)
        if (p) {
          postSet.add(pId)
          nodes.push({
            id: pId,
            kind: "post",
            label: p.title,
            slug: p.slug,
            x: W / 2 + (Math.random() - 0.5) * 300,
            y: H / 2 + (Math.random() - 0.5) * 300,
          })
        }
      }
      links.push({ source: e.id, target: pId, edgeKind: "mentions" })
    }
  }

  return { nodes, links }
}

function buildRelationGraph(
  ontology: NonNullable<ReturnType<typeof useOntologyQuery>["ontology"]>,
  postMap: Map<string, { id: string; title: string; slug: string }>
): { nodes: ONode[]; links: OLink[] } {
  const nodes: ONode[] = []
  const seenPosts = new Set<string>()
  const links: OLink[] = []

  for (const edge of ontology.edges) {
    for (const pid of [edge.source, edge.target]) {
      if (!seenPosts.has(pid)) {
        const p = postMap.get(pid)
        if (p) {
          seenPosts.add(pid)
          nodes.push({
            id: pid,
            kind: "post",
            label: p.title,
            slug: p.slug,
            x: W / 2 + (Math.random() - 0.5) * 300,
            y: H / 2 + (Math.random() - 0.5) * 300,
          })
        }
      }
    }
    links.push({
      source: edge.source,
      target: edge.target,
      edgeKind: edge.kind,
      confidence: edge.confidence,
    })
  }

  return { nodes, links }
}

const OntologyView = () => {
  const { ontology, isLoading } = useOntologyQuery()
  const graph = useNotionGraphQuery()
  const [view, setView] = useState<ViewMode>("entity")
  const [selected, setSelected] = useState<ONode | null>(null)
  const [search, setSearch] = useState("")
  const [simNodes, setSimNodes] = useState<ONode[]>([])
  const [simLinks, setSimLinks] = useState<OLink[]>([])
  const simRef = useRef<Simulation<ONode, OLink> | null>(null)

  const postMap = new Map(
    graph.nodes
      .filter((n) => n.kind === "post")
      .map((n) => [n.id, { id: n.id, title: (n as any).title, slug: (n as any).slug }])
  )

  useEffect(() => {
    if (!ontology) return

    const { nodes, links } =
      view === "entity"
        ? buildEntityGraph(ontology, postMap)
        : buildRelationGraph(ontology, postMap)

    simRef.current?.stop()

    const sim = forceSimulation<ONode>(nodes)
      .force(
        "link",
        forceLink<ONode, OLink>(links)
          .id((d) => d.id)
          .distance((l) => (l.edgeKind === "mentions" ? 90 : 120))
          .strength(0.3)
      )
      .force("charge", forceManyBody<ONode>().strength((n) => (n.kind === "entity" ? -180 : -80)))
      .force("center", forceCenter(W / 2, H / 2))
      .force("collide", forceCollide<ONode>((n) => (n.kind === "entity" ? 20 : 12)))

    sim.on("tick", () => {
      setSimNodes([...nodes])
      setSimLinks([...links])
    })

    simRef.current = sim
    return () => { sim.stop() }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ontology, view])

  if (isLoading) return <StyledWrapper><div className="status">Loading ontology…</div></StyledWrapper>
  if (!ontology) return (
    <StyledWrapper>
      <div className="status">
        Ontology not built yet.{" "}
        <code>POST /api/cron/ontology</code> 를 실행하세요.
      </div>
    </StyledWrapper>
  )

  const filteredEntityIds = search
    ? new Set(
        ontology.entities
          .filter((e) => e.name.toLowerCase().includes(search.toLowerCase()))
          .map((e) => e.id)
      )
    : null

  return (
    <StyledWrapper>
      <div className="toolbar">
        <div className="view-toggle">
          <button className={view === "entity" ? "active" : ""} onClick={() => setView("entity")}>
            entity
          </button>
          <button className={view === "relation" ? "active" : ""} onClick={() => setView("relation")}>
            relations
          </button>
        </div>
        <input
          className="search"
          placeholder="search entity…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      <div className="canvas-panel">
        <svg viewBox={`0 0 ${W} ${H}`} width="100%" height="100%">
          <g>
            {simLinks.map((l, i) => {
              const src = l.source as ONode
              const tgt = l.target as ONode
              if (!src.x || !tgt.x) return null
              const color = l.edgeKind === "mentions" ? "#444" : (EDGE_COLOR[l.edgeKind] ?? "#666")
              return (
                <line
                  key={i}
                  x1={src.x} y1={src.y} x2={tgt.x} y2={tgt.y}
                  stroke={color}
                  strokeWidth={l.edgeKind === "mentions" ? 0.6 : 1.2}
                  strokeOpacity={l.edgeKind === "mentions" ? 0.3 : Math.max(0.3, l.confidence ?? 0.6)}
                  strokeDasharray={l.edgeKind === "similar-topic" ? "4 3" : undefined}
                />
              )
            })}
          </g>
          <g>
            {simNodes.map((n) => {
              if (!n.x) return null
              const isEntity = n.kind === "entity"
              const dim = filteredEntityIds && isEntity && !filteredEntityIds.has(n.id)
              const fill = isEntity
                ? (ENTITY_COLOR[n.entityKind!] ?? "#888")
                : "#888"
              const r = isEntity ? 10 : 6
              const isSelected = selected?.id === n.id
              return (
                <g
                  key={n.id}
                  transform={`translate(${n.x},${n.y})`}
                  style={{ cursor: "pointer", opacity: dim ? 0.15 : 1 }}
                  onClick={() => setSelected(isSelected ? null : n)}
                >
                  <circle
                    r={isSelected ? r + 3 : r}
                    fill={fill}
                    stroke={isSelected ? "#fff" : "transparent"}
                    strokeWidth={1.5}
                  />
                  {(isEntity || isSelected) && (
                    <text
                      x={r + 4}
                      y={4}
                      fontSize={isEntity ? 11 : 9}
                      fill="#ccc"
                      fontFamily="var(--font-mono, monospace)"
                    >
                      {n.label.length > 20 ? n.label.slice(0, 20) + "…" : n.label}
                    </text>
                  )}
                </g>
              )
            })}
          </g>
        </svg>

        {selected && (
          <div className="panel">
            <button className="close" onClick={() => setSelected(null)}>✕</button>
            <div className="panel-kind">{selected.entityKind ?? "post"}</div>
            <div className="panel-name">{selected.label}</div>
            {selected.description && (
              <div className="panel-desc">{selected.description}</div>
            )}
            {selected.slug && (
              <Link href={`/${selected.slug}`} className="panel-link">→ 포스트 읽기</Link>
            )}
            {selected.postIds && selected.postIds.length > 0 && (
              <div className="panel-posts">
                <div className="panel-posts-label">관련 포스트</div>
                {selected.postIds.map((pid) => {
                  const p = postMap.get(pid)
                  if (!p) return null
                  return (
                    <Link key={pid} href={`/${p.slug}`} className="panel-post-item">
                      → {p.title.slice(0, 36)}{p.title.length > 36 ? "…" : ""}
                    </Link>
                  )
                })}
              </div>
            )}
          </div>
        )}
      </div>

      <div className="legend">
        {view === "entity" ? (
          Object.entries(ENTITY_COLOR).map(([k, c]) => (
            <span key={k} className="legend-item">
              <span className="dot" style={{ background: c }} />
              {k}
            </span>
          ))
        ) : (
          Object.entries(EDGE_COLOR).map(([k, c]) => (
            <span key={k} className="legend-item">
              <span className="line-sample" style={{ background: c }} />
              {k}
            </span>
          ))
        )}
      </div>
    </StyledWrapper>
  )
}

export default OntologyView

const StyledWrapper = styled.div`
  display: flex;
  flex-direction: column;
  height: 100vh;
  background: ${({ theme }) => theme.colors.editor.bg};
  color: ${({ theme }) => theme.colors.editor.fg};
  font-family: var(--font-mono, monospace);
  padding: 16px 20px;
  box-sizing: border-box;
  overflow: hidden;

  .status {
    margin: auto;
    font-size: 13px;
    color: ${({ theme }) => theme.colors.editor.fg3};
    code { font-size: 12px; }
  }

  .toolbar {
    display: flex;
    align-items: center;
    gap: 12px;
    margin-bottom: 12px;
    flex-shrink: 0;
  }

  .view-toggle {
    display: flex;
    gap: 2px;
    button {
      background: none;
      border: 1px solid ${({ theme }) => theme.colors.editor.line};
      color: ${({ theme }) => theme.colors.editor.fg3};
      font-family: inherit;
      font-size: 11px;
      padding: 4px 12px;
      cursor: pointer;
      letter-spacing: 0.5px;
      &.active {
        background: ${({ theme }) => theme.colors.editor.line};
        color: ${({ theme }) => theme.colors.editor.fg};
      }
    }
  }

  .search {
    background: none;
    border: 1px solid ${({ theme }) => theme.colors.editor.line};
    color: ${({ theme }) => theme.colors.editor.fg};
    font-family: inherit;
    font-size: 11px;
    padding: 4px 10px;
    width: 180px;
    outline: none;
    &::placeholder { color: ${({ theme }) => theme.colors.editor.fg3}; }
  }

  .canvas-panel {
    flex: 1;
    position: relative;
    border: 1px solid ${({ theme }) => theme.colors.editor.line};
    overflow: hidden;
    min-height: 0;
  }

  .panel {
    position: absolute;
    top: 12px;
    right: 12px;
    width: 220px;
    background: ${({ theme }) => theme.colors.editor.bg2};
    border: 1px solid ${({ theme }) => theme.colors.editor.line};
    padding: 14px 16px;
    font-size: 11px;
  }

  .close {
    position: absolute;
    top: 8px;
    right: 8px;
    background: none;
    border: none;
    color: ${({ theme }) => theme.colors.editor.fg3};
    cursor: pointer;
    font-size: 11px;
    padding: 2px;
  }

  .panel-kind {
    font-size: 9px;
    color: ${({ theme }) => theme.colors.editor.fg3};
    text-transform: uppercase;
    letter-spacing: 1px;
    margin-bottom: 4px;
  }

  .panel-name {
    font-size: 13px;
    font-weight: 500;
    color: ${({ theme }) => theme.colors.editor.fg};
    margin-bottom: 6px;
    word-break: break-word;
  }

  .panel-desc {
    font-size: 11px;
    color: ${({ theme }) => theme.colors.editor.fg3};
    line-height: 1.5;
    margin-bottom: 8px;
  }

  .panel-link {
    display: block;
    font-size: 11px;
    color: ${({ theme }) => theme.colors.editor.accent};
    text-decoration: none;
    margin-bottom: 10px;
    &:hover { opacity: 0.8; }
  }

  .panel-posts-label {
    font-size: 9px;
    color: ${({ theme }) => theme.colors.editor.fg3};
    text-transform: uppercase;
    letter-spacing: 1px;
    margin-bottom: 6px;
  }

  .panel-post-item {
    display: block;
    font-size: 10px;
    color: ${({ theme }) => theme.colors.editor.accent3};
    text-decoration: none;
    padding: 2px 0;
    &:hover { color: ${({ theme }) => theme.colors.editor.accent}; }
  }

  .legend {
    display: flex;
    gap: 16px;
    flex-wrap: wrap;
    padding-top: 10px;
    flex-shrink: 0;
  }

  .legend-item {
    display: flex;
    align-items: center;
    gap: 5px;
    font-size: 10px;
    color: ${({ theme }) => theme.colors.editor.fg3};
  }

  .dot {
    width: 8px;
    height: 8px;
    border-radius: 50%;
    flex-shrink: 0;
  }

  .line-sample {
    width: 16px;
    height: 2px;
    flex-shrink: 0;
  }
`
