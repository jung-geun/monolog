import { useEffect, useMemo, useRef, useState } from "react"
import Link from "next/link"
import styled from "@emotion/styled"
import WorkbenchIcon from "src/components/WorkbenchIcon"
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
import { useRegisterChrome } from "src/layouts/RootLayout/EditorChrome/RouteChromeContext"

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
  const statusItems = useMemo(
    () => ["Ontology", ontology ? `${ontology.entities.length} entities` : "No data available", "Inferred relationships"],
    [ontology]
  )
  useRegisterChrome("Ontology", statusItems, "page")

  const postMap = new Map(
    graph.nodes.flatMap((node) => node.kind === "post" && node.slug
      ? [[node.id, { id: node.id, title: node.title, slug: node.slug }] as const]
      : [])
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

  if (isLoading) return <StyledWrapper><div className="status" role="status"><WorkbenchIcon name="link" size={24} /><h1>Ontology</h1><p>Loading entities and inferred relationships…</p></div></StyledWrapper>
  if (!ontology || (!ontology.entities.length && !ontology.edges.length)) return (
    <StyledWrapper>
      <div className="status" role="status"><WorkbenchIcon name="link" size={24} /><h1>Ontology</h1>
        <p>No entities or inferred relationships are currently available.</p>
        <p>Explore posts and explicit connections in the knowledge graph.</p>
        <Link href="/graph">Open knowledge graph <WorkbenchIcon name="arrow-right" size={14} /></Link>
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
      <header className="editor-heading"><WorkbenchIcon name="link" size={18} /><h1>Ontology</h1><span>{ontology.entities.length} entities · {ontology.edges.length} inferred relations</span></header>
      <div className="toolbar">
        <div className="view-toggle">
          <button type="button" aria-pressed={view === "entity"} className={view === "entity" ? "active" : ""} onClick={() => setView("entity")}>
            Entities
          </button>
          <button type="button" aria-pressed={view === "relation"} className={view === "relation" ? "active" : ""} onClick={() => setView("relation")}>
            Relations
          </button>
        </div>
        <input
          className="search"
          type="search"
          aria-label="Find an ontology entity"
          placeholder="Find an entity…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          onKeyDown={event => { if (event.key === "Escape") setSearch("") }}
        />
      </div>

      <div className="canvas-panel">
        <svg viewBox={`0 0 ${W} ${H}`} width="100%" height="100%" aria-label="Ontology relationship visualization">
          <g>
            {simLinks.map((l, i) => {
              const src = l.source as ONode
              const tgt = l.target as ONode
              if (!src.x || !tgt.x) return null
              const color = l.edgeKind === "mentions" ? "rgb(var(--c-hairline))" : (EDGE_COLOR[l.edgeKind] ?? "currentColor")
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
                  role="button"
                  tabIndex={0}
                  aria-label={`${n.kind}: ${n.label}`}
                  aria-pressed={isSelected}
                  style={{ cursor: "pointer", opacity: dim ? 0.15 : 1 }}
                  onClick={() => setSelected(isSelected ? null : n)}
                  onKeyDown={event => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); setSelected(isSelected ? null : n) } }}
                >
                  <circle
                    r={isSelected ? r + 3 : r}
                    fill={fill}
                    stroke={isSelected ? "currentColor" : "transparent"}
                    strokeWidth={1.5}
                  />
                  {(isEntity || isSelected) && (
                    <text
                      x={r + 4}
                      y={4}
                      fontSize={isEntity ? 11 : 9}
                      fill="currentColor"
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
            <button type="button" className="close" aria-label="Close ontology details" onClick={() => setSelected(null)}><WorkbenchIcon name="close" size={16} /></button>
            <div className="panel-kind">{selected.entityKind ?? "post"}</div>
            <div className="panel-name">{selected.label}</div>
            {selected.description && (
              <div className="panel-desc">{selected.description}</div>
            )}
            {selected.slug && (
              <Link href={`/${selected.slug}`} className="panel-link">Open post <WorkbenchIcon name="arrow-right" size={14} /></Link>
            )}
            {selected.postIds && selected.postIds.length > 0 && (
              <div className="panel-posts">
                <div className="panel-posts-label">Related posts</div>
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
  flex: 1;
  height: 100%;
  min-height: 480px;
  background: ${({ theme }) => theme.colors.editor.bg};
  color: ${({ theme }) => theme.colors.editor.fg};
  font-family: var(--font-ui, sans-serif);
  padding: 16px 20px;
  box-sizing: border-box;
  overflow: hidden;

  .status { margin: auto; max-width: 480px; padding: 24px; line-height: 1.7; font-size: 13px; color: ${({ theme }) => theme.colors.editor.fg2}; }
  .status h1 { font-size: 20px; color: ${({ theme }) => theme.colors.editor.fg}; margin: 12px 0; }
  .status a { display: inline-flex; align-items: center; gap: 5px; color: ${({ theme }) => theme.colors.editor.accent}; text-decoration: none; }
  .editor-heading { display: flex; align-items: center; gap: 8px; margin-bottom: 16px; }
  .editor-heading h1 { margin: 0; font-size: 16px; font-weight: 500; }
  .editor-heading > span { font-size: 11px; color: ${({ theme }) => theme.colors.editor.fg3}; margin-left: auto; }
  button:focus-visible, a:focus-visible, input:focus-visible, svg g[role=button]:focus-visible { outline: 1px solid ${({ theme }) => theme.colors.editor.accent}; outline-offset: 2px; }

  .toolbar {
    display: flex;
    align-items: center;
    gap: 12px;
    flex-wrap: wrap;
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
    background: ${({ theme }) => theme.colors.editor.bg3};
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
    max-height: calc(100% - 24px);
    overflow-y: auto;
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
    display: flex;
    align-items: center;
    gap: 6px;
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

  @media (max-width: ${({ theme }) => theme.variables.breakpoint}px) {
    flex: none; height: 74dvh; min-height: 480px; padding: 16px 12px;
    .editor-heading { flex-wrap: wrap; }
    .editor-heading > span { flex-basis: 100%; margin-left: 26px; }
    .panel { top: auto; bottom: 10px; left: 10px; right: 10px; width: auto; max-height: 45%; }
    .legend { gap: 8px 12px; }
  }
`
