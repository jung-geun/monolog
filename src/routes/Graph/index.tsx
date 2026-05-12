import { useState, useMemo } from "react"
import styled from "@emotion/styled"
import Link from "next/link"
import useNotionGraphQuery from "src/hooks/useNotionGraphQuery"
import { useRegisterChrome } from "src/layouts/RootLayout/EditorChrome/RouteChromeContext"
import { buildGraph } from "src/libs/utils/graph"

const W = 720
const H = 520

const Graph = () => {
  const graph = useNotionGraphQuery()
  const { nodes, edges, cats, catCenters } = buildGraph(graph, W, H)
  const [selectedIdx, setSelectedIdx] = useState(0)
  const [hoverCat, setHoverCat] = useState<string | null>(null)

  const selected = nodes[selectedIdx]
  const connectedEdges = edges.filter((e) => e.a === selectedIdx || e.b === selectedIdx)
  const connectedNodes = connectedEdges.map((e) => {
    const idx = e.a === selectedIdx ? e.b : e.a
    return {
      idx,
      node: nodes[idx],
      via: e.type,
    }
  })

  const catColors: Record<string, string> = {}
  nodes.forEach((n) => { catColors[n.category] = n.color })

  const isDimmed = (cat: string) => hoverCat !== null && hoverCat !== cat

  const statusItems = useMemo(() => {
    const typeCounts = edges.reduce<Record<string, number>>((acc, e) => {
      acc[e.type] = (acc[e.type] ?? 0) + 1
      return acc
    }, {})
    const typeStr = Object.entries(typeCounts)
      .map(([t, n]) => `${n} ${t}`)
      .join(" · ")
    return ["graph", `${nodes.length} nodes`, `${edges.length} edges${typeStr ? ` (${typeStr})` : ""}`, "deterministic layout"]
  }, [nodes.length, edges.length, edges])
  useRegisterChrome("graph.json", statusItems)

  return (
    <StyledWrapper>
      <div className="graph-layout">
        {/* SVG canvas */}
        <div className="canvas-area">
          <svg
            viewBox={`0 0 ${W} ${H}`}
            preserveAspectRatio="xMidYMid meet"
            className="graph-svg"
          >
            <defs>
              <pattern id="grid" width="32" height="32" patternUnits="userSpaceOnUse">
                <path d="M 32 0 L 0 0 0 32" fill="none" stroke="currentColor" strokeWidth="1" />
              </pattern>
            </defs>
            <rect width="100%" height="100%" fill="url(#grid)" className="grid-bg" />

            {edges.map((e, i) => {
              const dim = isDimmed(nodes[e.a].category) && isDimmed(nodes[e.b].category)
              const stroke = e.sameCategory ? nodes[e.a].color : "currentColor"
              return (
                <line
                  key={i}
                  x1={nodes[e.a].x} y1={nodes[e.a].y}
                  x2={nodes[e.b].x} y2={nodes[e.b].y}
                  stroke={stroke}
                  strokeWidth={Math.min(e.weight * 0.6, 1.5)}
                  className={`edge${e.sameCategory ? " same-cat" : ""}`}
                  opacity={dim ? 0.05 : (e.sameCategory ? 0.55 : 0.18)}
                />
              )
            })}

            {cats.map((c) => {
              const cl = catCenters[c]
              return (
                <g
                  key={c}
                  className="cluster"
                  opacity={isDimmed(c) ? 0.25 : 1}
                >
                  <circle
                    cx={cl.x} cy={cl.y} r={70}
                    fill={catColors[c]}
                    opacity={hoverCat === c ? 0.08 : 0.04}
                  />
                  <text
                    x={cl.x}
                    y={cl.y - 78}
                    className="cluster-label"
                    fill={catColors[c]}
                    textAnchor="middle"
                  >
                    #{c}
                  </text>
                </g>
              )
            })}

            {nodes.map((n, i) => {
              const sz = 5 + Math.min(n.readTime / 5, 8)
              const isSelected = i === selectedIdx
              const dim = isDimmed(n.category)
              return (
                <g
                  key={n.slug}
                  onClick={() => setSelectedIdx(i)}
                  style={{ cursor: "pointer" }}
                  opacity={dim ? 0.15 : 1}
                >
                  {isSelected && (
                    <circle
                      cx={n.x} cy={n.y} r={sz + 5}
                      fill="none"
                      stroke={n.color}
                      strokeWidth={1.5}
                      opacity={0.55}
                    />
                  )}
                  <circle
                    cx={n.x} cy={n.y} r={sz}
                    fill={n.color}
                    opacity={isSelected ? 1 : 0.85}
                  />
                  {(isSelected || hoverCat === n.category) && (
                    <text
                      x={n.x + sz + 4} y={n.y + 3}
                      className="node-label"
                      fill={n.color}
                    >
                      {n.title.length > 26 ? n.title.slice(0, 26) + "…" : n.title}
                    </text>
                  )}
                </g>
              )
            })}
          </svg>

          <div className="legend">
            <span>nodes: {nodes.length}</span>
            <span>edges: {edges.length}</span>
            <span className="sep">|</span>
            <span>○ post · size = read time</span>
            <span>— mention/link/relation</span>
          </div>
        </div>

        {/* Detail panel */}
        <div className="detail-panel">
          {selected && (
            <>
              <div className="panel-label">selected</div>
              <div className="selected-title">{selected.title}</div>
              <div className="selected-meta">{selected.category}</div>
              <div className="selected-tags">
                {selected.tags.map((t) => (
                  <span key={t} className="tag">#{t}</span>
                ))}
              </div>

              <Link href={`/${selected.slug}`} className="open-link">
                → open post
              </Link>

              <div className="panel-label" style={{ marginTop: 20 }}>
                connected ({connectedNodes.length})
              </div>
              {connectedNodes.slice(0, 5).map(({ idx, node, via }) => (
                <button
                  key={node.slug}
                  type="button"
                  className="connected-item"
                  onClick={() => setSelectedIdx(idx)}
                >
                  <div className="connected-title">→ {node.title.slice(0, 30)}{node.title.length > 30 ? "…" : ""}</div>
                  <div className="connected-via">via {via}</div>
                </button>
              ))}

              <div className="panel-label" style={{ marginTop: 20 }}>filter</div>
              <div className="cat-filters">
                {cats.map((c) => (
                  <span
                    key={c}
                    className={`cat-chip${hoverCat === c ? " active" : ""}`}
                    style={{
                      color: catColors[c],
                      borderColor: hoverCat === c ? catColors[c] : undefined,
                      background: hoverCat === c ? `${catColors[c]}1f` : undefined,
                    }}
                    onMouseEnter={() => setHoverCat(c)}
                    onMouseLeave={() => setHoverCat(null)}
                  >
                    <span className="dot" style={{ background: catColors[c] }} />#{c}
                  </span>
                ))}
              </div>
            </>
          )}
        </div>
      </div>
    </StyledWrapper>
  )
}

export default Graph

const StyledWrapper = styled.div`
  display: flex;
  flex-direction: column;
  flex: 1;
  min-height: 0;
  overflow: hidden;

  .graph-layout {
    flex: 1;
    display: grid;
    grid-template-columns: 1fr 280px;
    min-height: 0;

    @media (max-width: ${({ theme }) => theme.variables.breakpoint}px) {
      grid-template-columns: 1fr;
    }
  }

  .canvas-area {
    position: relative;
    background: ${({ theme }) => theme.colors.editor.bg};
    border-right: 1px solid ${({ theme }) => theme.colors.editor.line};
    overflow: hidden;
  }

  .graph-svg {
    width: 100%;
    height: 100%;

    .grid-bg {
      color: ${({ theme }) => theme.colors.editor.line};
      opacity: 0.4;
    }

    .edge {
      stroke: ${({ theme }) => theme.colors.editor.line2};
      opacity: 0.55;
    }

    .cluster-label {
      font-family: ui-monospace, monospace;
      font-size: 11px;
      fill: ${({ theme }) => theme.colors.editor.fg3};
      text-transform: uppercase;
      letter-spacing: 1.5px;
    }

    .node {
      fill: ${({ theme }) => theme.colors.editor.fg};
      opacity: 0.78;
      cursor: pointer;
      &:hover { opacity: 1; fill: ${({ theme }) => theme.colors.editor.accent}; }
    }

    .node-selected {
      fill: ${({ theme }) => theme.colors.editor.accent};
    }

    .selected-ring {
      fill: none;
      stroke: ${({ theme }) => theme.colors.editor.accent};
      stroke-width: 1.5px;
      opacity: 0.5;
    }

    .node-label {
      font-family: ui-monospace, monospace;
      font-size: 9.5px;
      fill: ${({ theme }) => theme.colors.editor.fg2};
      pointer-events: none;
      &.selected { fill: ${({ theme }) => theme.colors.editor.accent}; }
    }
  }

  .legend {
    position: absolute;
    bottom: 14px;
    left: 20px;
    font-family: var(--font-mono, monospace);
    font-size: 10px;
    color: ${({ theme }) => theme.colors.editor.fg3};
    display: flex;
    gap: 14px;
    align-items: center;
    padding: 6px 10px;
    background: ${({ theme }) => theme.colors.editor.bg2};
    border: 1px solid ${({ theme }) => theme.colors.editor.line};

    .sep { color: ${({ theme }) => theme.colors.editor.fg4}; }
  }

  .detail-panel {
    background: ${({ theme }) => theme.colors.editor.bg2};
    padding: 18px;
    font-family: var(--font-mono, monospace);
    font-size: 12px;
    overflow-y: auto;
    scrollbar-width: none;
    &::-webkit-scrollbar { display: none; }

    @media (max-width: ${({ theme }) => theme.variables.breakpoint}px) {
      display: none;
    }
  }

  .panel-label {
    font-size: 10px;
    color: ${({ theme }) => theme.colors.editor.fg3};
    text-transform: uppercase;
    letter-spacing: 1.5px;
    margin-bottom: 8px;
  }

  .selected-title {
    font-size: 18px;
    font-weight: 500;
    color: ${({ theme }) => theme.colors.editor.fg};
    line-height: 1.3;
    margin-bottom: 6px;
  }

  .selected-meta {
    color: ${({ theme }) => theme.colors.editor.fg3};
    font-size: 11px;
    margin-bottom: 10px;
  }

  .selected-tags {
    display: flex;
    gap: 6px;
    flex-wrap: wrap;
    margin-bottom: 12px;

    .tag {
      padding: 1px 8px;
      background: ${({ theme }) => theme.colors.editor.accentSoft};
      color: ${({ theme }) => theme.colors.editor.accent};
      border: 1px solid ${({ theme }) => theme.colors.editor.accent};
      font-size: 11px;
    }
  }

  .open-link {
    font-size: 12px;
    color: ${({ theme }) => theme.colors.editor.accent3};
    text-decoration: none;
    display: block;
    margin-bottom: 4px;
    &:hover { color: ${({ theme }) => theme.colors.editor.accent}; }
  }

  .connected-item {
    display: block;
    width: 100%;
    text-align: left;
    background: transparent;
    border: none;
    border-bottom: 1px dashed ${({ theme }) => theme.colors.editor.line};
    padding: 6px 0;
    cursor: pointer;
    font-family: inherit;
    transition: background 0.12s;

    .connected-title { color: ${({ theme }) => theme.colors.editor.accent3}; font-size: 12px; }
    .connected-via { color: ${({ theme }) => theme.colors.editor.fg3}; font-size: 10px; margin-top: 2px; }

    &:hover {
      background: ${({ theme }) => theme.colors.editor.bg};
      .connected-title { color: ${({ theme }) => theme.colors.editor.accent}; }
    }
    &:focus-visible {
      outline: 1px solid ${({ theme }) => theme.colors.editor.accent};
      outline-offset: -1px;
    }
  }

  .cat-filters {
    display: flex;
    gap: 4px;
    flex-wrap: wrap;

    .cat-chip {
      display: inline-flex;
      align-items: center;
      gap: 5px;
      padding: 2px 8px;
      border: 1px solid ${({ theme }) => theme.colors.editor.line};
      background: ${({ theme }) => theme.colors.editor.bg};
      color: ${({ theme }) => theme.colors.editor.fg2};
      font-size: 10px;
      cursor: pointer;
      transition: background 0.12s, border-color 0.12s;

      .dot {
        width: 6px;
        height: 6px;
        border-radius: 50%;
        flex-shrink: 0;
      }
    }
  }
`
