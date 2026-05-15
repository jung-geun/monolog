import { useState, useMemo, useEffect, useRef, useCallback } from "react"
import styled from "@emotion/styled"
import Link from "next/link"
import {
  forceSimulation,
  forceLink,
  forceManyBody,
  forceCenter,
  forceCollide,
  forceX,
  forceY,
  type Simulation,
  type ForceManyBody,
  type ForceLink as ForceLinkType,
  SimulationNodeDatum,
  SimulationLinkDatum,
} from "d3-force"
import type { ForceX as ForceXType, ForceY as ForceYType } from "d3-force"
import { drag, type D3DragEvent } from "d3-drag"
import { select } from "d3-selection"
import { zoom, zoomIdentity, type ZoomBehavior } from "d3-zoom"
import useNotionGraphQuery from "src/hooks/useNotionGraphQuery"
import { useRegisterChrome } from "src/layouts/RootLayout/EditorChrome/RouteChromeContext"
import { buildGraph, GraphNode, SERIES_COLOR, TAG_COLOR } from "src/libs/utils/graph"

const W = 720
const H = 520

type SimLink = SimulationLinkDatum<GraphNode & SimulationNodeDatum> & { weight: number }

const Graph = () => {
  const graph = useNotionGraphQuery()

  const { nodes, edges, cats } = useMemo(
    () => buildGraph(graph, W, H),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [graph.generatedAt]
  )

  const [selectedIdx, setSelectedIdx] = useState(0)
  const [hoverCat, setHoverCat] = useState<string | null>(null)
  const [repulsion, setRepulsion] = useState(30)
  const [centering, setCentering] = useState(0.04)
  const [linkDistance, setLinkDistance] = useState(40)
  const [linkStrength, setLinkStrength] = useState(1.0)

  // Animation state
  const [isPlaying, setIsPlaying] = useState(false)
  const [animSpeed, setAnimSpeed] = useState(5)
  const [animRevealCount, setAnimRevealCount] = useState<number | null>(null)

  const selected = nodes[selectedIdx]

  // CONNECTED dedupe: 같은 페어가 여러 엣지 타입으로 연결된 경우 1줄로 머지
  const connectedNodes = useMemo(() => {
    const byIdx = new Map<number, string[]>()
    for (const e of edges) {
      if (e.a !== selectedIdx && e.b !== selectedIdx) continue
      const idx = e.a === selectedIdx ? e.b : e.a
      const prev = byIdx.get(idx) ?? []
      if (!prev.includes(e.type)) prev.push(e.type)
      byIdx.set(idx, prev)
    }
    return [...byIdx.entries()].map(([idx, vias]) => ({
      idx,
      node: nodes[idx],
      via: vias.join(" · "),
    }))
  }, [edges, nodes, selectedIdx])

  const selectedKind = selected?.kind ?? "post"

  const catColors: Record<string, string> = {}
  nodes.forEach((n) => { if (n.category) catColors[n.category] = n.color })

  // Node appearance rank for timeline animation (post-unit, createdAt order)
  const { nodeAppearRank, postCount } = useMemo(() => {
    const rank = new Array(nodes.length).fill(Infinity)

    // (1) post 노드: createdAt 오름차순으로 rank 부여
    const postsByDate = nodes
      .map((n, i) => ({ i, date: n.kind === "post" ? (n.createdAt ?? "") : "" }))
      .filter((p) => p.date !== "" && nodes[p.i].kind === "post")
      .sort((a, b) => a.date.localeCompare(b.date))
    postsByDate.forEach(({ i }, r) => { rank[i] = r })

    // (2) createdAt 없는 post는 dated posts 뒤로
    let next = postsByDate.length
    nodes.forEach((n, i) => {
      if (n.kind === "post" && rank[i] === Infinity) rank[i] = next++
    })
    const total = next

    // (3) hub 노드: 연결된 post 중 가장 빠른 rank에 함께 등장
    for (const e of edges) {
      const na = nodes[e.a], nb = nodes[e.b]
      if (na.kind === "post" && nb.kind !== "post") {
        rank[e.b] = Math.min(rank[e.b], rank[e.a])
      } else if (nb.kind === "post" && na.kind !== "post") {
        rank[e.a] = Math.min(rank[e.a], rank[e.b])
      }
    }

    // (4) isolated hub(연결된 post 없음)는 맨 마지막
    nodes.forEach((n, i) => {
      if (n.kind !== "post" && rank[i] === Infinity) rank[i] = total
    })

    return { nodeAppearRank: rank, postCount: total }
  }, [nodes, edges])

  const isDimmed = (cat: string) => hoverCat !== null && hoverCat !== cat

  const statusItems = useMemo(() => {
    const typeCounts = edges.reduce<Record<string, number>>((acc, e) => {
      acc[e.type] = (acc[e.type] ?? 0) + 1
      return acc
    }, {})
    const typeStr = Object.entries(typeCounts)
      .map(([t, n]) => `${n} ${t}`)
      .join(" · ")
    return ["graph", `${nodes.length} nodes`, `${edges.length} edges${typeStr ? ` (${typeStr})` : ""}`, "force simulation"]
  }, [nodes.length, edges])
  useRegisterChrome("graph.json", statusItems)

  // DOM refs for direct coordinate updates during simulation tick
  const circleRefs = useRef<(SVGCircleElement | null)[]>([])
  const ringRefs = useRef<(SVGCircleElement | null)[]>([])
  const labelRefs = useRef<(SVGTextElement | null)[]>([])
  const lineRefs = useRef<(SVGLineElement | null)[]>([])
  const catLabelRefs = useRef<Record<string, SVGTextElement | null>>({})
  const nodesLayerRef = useRef<SVGGElement | null>(null)

  // Force instance refs for mutation without simulation restart
  type N = GraphNode & SimulationNodeDatum
  const simRef = useRef<Simulation<N, undefined> | null>(null)
  const chargeRef = useRef<ForceManyBody<N> | null>(null)
  const xForceRef = useRef<ForceXType<N> | null>(null)
  const yForceRef = useRef<ForceYType<N> | null>(null)
  const linkForceRef = useRef<ForceLinkType<N, SimLink> | null>(null)

  // Animation refs
  const animIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const animRevealRef = useRef(0)

  // Zoom refs
  const svgRef = useRef<SVGSVGElement | null>(null)
  const zoomRootRef = useRef<SVGGElement | null>(null)
  const zoomBehaviorRef = useRef<ZoomBehavior<SVGSVGElement, unknown> | null>(null)

  // Force-directed simulation
  useEffect(() => {
    if (!nodes.length) return

    const links: SimLink[] = edges.map((e) => ({
      source: e.a,
      target: e.b,
      weight: e.weight,
    }))

    const chargeF = forceManyBody().strength(-repulsion)
    const xF = forceX<GraphNode & SimulationNodeDatum>(W / 2).strength(centering)
    const yF = forceY<GraphNode & SimulationNodeDatum>(H / 2).strength(centering)
    const linkF = forceLink<GraphNode & SimulationNodeDatum, SimLink>(links)
      .id((_, i) => i)
      .distance((d) => linkDistance / Math.max(1, Math.sqrt(d.weight)))
      .strength((d) => Math.min(1, linkStrength * (0.2 + 0.15 * d.weight)))

    const sim = forceSimulation<GraphNode & SimulationNodeDatum>(nodes as (GraphNode & SimulationNodeDatum)[])
      .force("link", linkF)
      .force("charge", chargeF)
      .force("center", forceCenter(W / 2, H / 2))
      .force("x", xF)
      .force("y", yF)
      .force("collide", forceCollide(11))
      .alpha(1)
      .alphaDecay(0.03)
      .on("tick", () => {
        nodes.forEach((n, i) => {
          const sz = n.kind === "post"
            ? 4 + Math.sqrt(Math.max(n.readTime ?? 1, 1)) * 2
            : 4 + Math.sqrt(Math.max(n.degree, 1)) * 1.8
          circleRefs.current[i]?.setAttribute("cx", String(n.x))
          circleRefs.current[i]?.setAttribute("cy", String(n.y))
          ringRefs.current[i]?.setAttribute("cx", String(n.x))
          ringRefs.current[i]?.setAttribute("cy", String(n.y))
          const lbl = labelRefs.current[i]
          if (lbl) {
            lbl.setAttribute("x", String(n.x + sz + 4))
            lbl.setAttribute("y", String(n.y + 3))
          }
        })
        edges.forEach((e, i) => {
          const src = nodes[e.a], tgt = nodes[e.b]
          const l = lineRefs.current[i]
          if (l) {
            l.setAttribute("x1", String(src.x))
            l.setAttribute("y1", String(src.y))
            l.setAttribute("x2", String(tgt.x))
            l.setAttribute("y2", String(tgt.y))
          }
        })
        cats.forEach((c) => {
          const catNodes = nodes.filter((n) => n.category === c)
          if (!catNodes.length) return
          const cx = catNodes.reduce((s, n) => s + (n.x ?? 0), 0) / catNodes.length
          const cy = catNodes.reduce((s, n) => s + (n.y ?? 0), 0) / catNodes.length
          const el = catLabelRefs.current[c]
          if (el) {
            el.setAttribute("x", String(cx))
            el.setAttribute("y", String(cy - 20))
          }
        })
      })

    simRef.current = sim
    chargeRef.current = chargeF
    xForceRef.current = xF
    yForceRef.current = yF
    linkForceRef.current = linkF

    if (nodesLayerRef.current) {
      type DragEv = D3DragEvent<SVGGElement, GraphNode, GraphNode>
      const dragBehavior = drag<SVGGElement, GraphNode>()
        .clickDistance(4)
        .on("start", (event: DragEv, d) => {
          if (!event.active) sim.alphaTarget(0.3).restart()
          d.fx = d.x
          d.fy = d.y
        })
        .on("drag", (event: DragEv, d) => {
          d.fx = event.x
          d.fy = event.y
        })
        .on("end", (event: DragEv, d) => {
          if (!event.active) sim.alphaTarget(0)
          d.fx = null
          d.fy = null
        })

      select(nodesLayerRef.current)
        .selectAll<SVGGElement, GraphNode>("g.node")
        .data(nodes, (_, i) => String(i))
        .call(dragBehavior)
    }

    return () => { sim.stop() }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [graph.generatedAt])

  // Force parameter mutation when sliders change — no simulation restart
  useEffect(() => {
    if (!simRef.current || !chargeRef.current) return
    chargeRef.current.strength(-repulsion)
    xForceRef.current?.strength(centering)
    yForceRef.current?.strength(centering)
    if (linkForceRef.current) {
      linkForceRef.current
        .distance((d: SimLink) => linkDistance / Math.max(1, Math.sqrt(d.weight)))
        .strength((d: SimLink) => Math.min(1, linkStrength * (0.2 + 0.15 * d.weight)))
    }
    simRef.current.alpha(0.5).restart()
  }, [repulsion, centering, linkDistance, linkStrength])

  // Keep animRevealRef in sync (stale closure 방지)
  useEffect(() => { animRevealRef.current = animRevealCount ?? 0 }, [animRevealCount])

  // Animation: reveal nodes (+ hub + edges) in post createdAt order
  useEffect(() => {
    if (!isPlaying) {
      if (animIntervalRef.current) {
        clearInterval(animIntervalRef.current)
        animIntervalRef.current = null
      }
      return
    }

    let revealed = animRevealRef.current
    const intervalMs = Math.max(50, Math.round(1000 / animSpeed))

    animIntervalRef.current = setInterval(() => {
      revealed += 1
      if (revealed >= postCount) {
        clearInterval(animIntervalRef.current!)
        animIntervalRef.current = null
        setAnimRevealCount(postCount)
        setIsPlaying(false)
      } else {
        setAnimRevealCount(revealed)
      }
    }, intervalMs)

    return () => {
      if (animIntervalRef.current) {
        clearInterval(animIntervalRef.current)
        animIntervalRef.current = null
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isPlaying, animSpeed, postCount])

  // Zoom/pan behavior — mounted once, cleaned up on unmount
  useEffect(() => {
    const svgEl = svgRef.current
    if (!svgEl) return
    const z = zoom<SVGSVGElement, unknown>()
      .scaleExtent([0.3, 4])
      .filter((event) => {
        if (event.type === "wheel") return true
        const target = event.target as SVGElement | null
        if (target?.closest("g.node")) return false
        return !event.ctrlKey && event.button === 0
      })
      .on("zoom", (event) => {
        zoomRootRef.current?.setAttribute("transform", event.transform.toString())
      })

    select(svgEl).call(z)
    zoomBehaviorRef.current = z

    return () => { select(svgEl).on(".zoom", null) }
  }, [])

  const handleResetView = () => {
    if (!svgRef.current || !zoomBehaviorRef.current) return
    select(svgRef.current)
      .transition()
      .duration(300)
      .call(zoomBehaviorRef.current.transform, zoomIdentity)
  }

  const handleResetForce = () => {
    setRepulsion(30)
    setCentering(0.04)
    setLinkDistance(40)
    setLinkStrength(1.0)
  }

  const handlePlayAnim = useCallback(() => {
    if (isPlaying) {
      setIsPlaying(false)
      return
    }
    // 재생 완료 상태(postCount) 또는 첫 진입(null)이면 0부터 시작
    if (animRevealCount === null || animRevealCount >= postCount) {
      setAnimRevealCount(0)
    }
    setIsPlaying(true)
  }, [isPlaying, animRevealCount, postCount])

  const handleResetAnim = useCallback(() => {
    setIsPlaying(false)
    setAnimRevealCount(0)  // 빈 캔버스로
  }, [])

  return (
    <StyledWrapper>
      <div className="graph-layout">
        {/* SVG canvas */}
        <div className="canvas-area">
          <svg
            ref={svgRef}
            viewBox={`0 0 ${W} ${H}`}
            preserveAspectRatio="xMidYMid meet"
            className="graph-svg"
          >
            <defs>
              <pattern id="grid" width="32" height="32" patternUnits="userSpaceOnUse">
                <path d="M 32 0 L 0 0 0 32" fill="none" stroke="currentColor" strokeWidth="1" />
              </pattern>
            </defs>

            <g ref={zoomRootRef} className="zoom-root">
              <rect width={W} height={H} fill="url(#grid)" className="grid-bg" />

              {edges.map((e, i) => {
                const na = nodes[e.a], nb = nodes[e.b]
                const dimA = isDimmed(na.category ?? "")
                const dimB = isDimmed(nb.category ?? "")
                const dim = dimA && dimB

                let stroke = "currentColor"
                let opacity = 0.18
                if (e.type === "has-tag") {
                  stroke = TAG_COLOR
                  opacity = dim ? 0.03 : 0.3
                } else if (e.type === "in-series") {
                  stroke = SERIES_COLOR
                  opacity = dim ? 0.03 : 0.3
                } else if (e.type === "series-next") {
                  stroke = na.kind === "post" ? na.color : "currentColor"
                  opacity = dim ? 0.04 : 0.6
                } else if (e.sameCategory) {
                  stroke = na.color
                  opacity = dim ? 0.05 : 0.55
                }

                // During animation, hide edges until both endpoint nodes are revealed
                const edgeRank = nodeAppearRank[e.a] > nodeAppearRank[e.b]
                  ? nodeAppearRank[e.a] : nodeAppearRank[e.b]
                const isRevealed = animRevealCount === null || edgeRank < animRevealCount
                const finalOpacity = isRevealed ? opacity : 0

                return (
                  <line
                    key={i}
                    ref={(el) => { lineRefs.current[i] = el }}
                    x1={na.x} y1={na.y}
                    x2={nb.x} y2={nb.y}
                    stroke={stroke}
                    strokeWidth={Math.min(e.weight * 0.6, 1.5)}
                    className={`edge${e.sameCategory ? " same-cat" : ""}`}
                    style={{
                      opacity: finalOpacity,
                      transition: animRevealCount !== null ? "opacity 0.25s" : undefined,
                    }}
                  />
                )
              })}

              {cats.map((c) => {
                const initX = nodes.filter((n) => n.category === c).reduce((s, n) => s + n.x, 0) / Math.max(1, nodes.filter((n) => n.category === c).length)
                const initY = nodes.filter((n) => n.category === c).reduce((s, n) => s + n.y, 0) / Math.max(1, nodes.filter((n) => n.category === c).length)
                return (
                  <text
                    key={c}
                    ref={(el) => { catLabelRefs.current[c] = el }}
                    x={initX}
                    y={initY - 20}
                    className="cluster-label"
                    fill={catColors[c]}
                    textAnchor="middle"
                    opacity={isDimmed(c) ? 0.25 : 1}
                  >
                    #{c}
                  </text>
                )
              })}

              <g ref={nodesLayerRef} className="nodes-layer">
                {nodes.map((n, i) => {
                  const sz = n.kind === "post"
                    ? 4 + Math.sqrt(Math.max(n.readTime ?? 1, 1)) * 2
                    : 4 + Math.sqrt(Math.max(n.degree, 1)) * 1.8
                  const isSelected = i === selectedIdx
                  const dim = isDimmed(n.category ?? "")
                  const showLabel =
                    n.kind !== "post" || isSelected || hoverCat === n.category
                  const isNodeRevealed = animRevealCount === null || nodeAppearRank[i] < animRevealCount
                  return (
                    <g
                      key={n.id}
                      className="node"
                      onClick={() => { if (isNodeRevealed) setSelectedIdx(i) }}
                      style={{
                        cursor: isNodeRevealed ? "pointer" : "default",
                        // CSS class .node{opacity:0.78} 를 inline style로 덮어씌워야 함
                        opacity: !isNodeRevealed ? 0 : dim ? 0.15 : undefined,
                        pointerEvents: isNodeRevealed ? undefined : "none",
                        transition: animRevealCount !== null ? "opacity 0.3s" : undefined,
                      }}
                    >
                      {isSelected && (
                        <circle
                          ref={(el) => { ringRefs.current[i] = el }}
                          cx={n.x} cy={n.y} r={sz + 5}
                          fill="none"
                          stroke={n.color}
                          strokeWidth={1.5}
                          opacity={0.55}
                        />
                      )}
                      <circle
                        ref={(el) => { circleRefs.current[i] = el }}
                        cx={n.x} cy={n.y} r={sz}
                        fill={n.color}
                        opacity={isSelected ? 1 : 0.85}
                      />
                      {showLabel && (
                        <text
                          ref={(el) => { labelRefs.current[i] = el }}
                          x={n.x + sz + 4} y={n.y + 3}
                          className="node-label"
                          fill={n.color}
                        >
                          {n.kind !== "post"
                            ? `#${n.title}`
                            : n.title.length > 26 ? n.title.slice(0, 26) + "…" : n.title}
                        </text>
                      )}
                    </g>
                  )
                })}
              </g>
            </g>
          </svg>

          <div className="legend">
            <span>nodes: {nodes.length}</span>
            <span>edges: {edges.length}</span>
            <span className="sep">|</span>
            <span>○ post · ◆ tag · ◇ series</span>
          </div>
        </div>

        {/* Detail panel */}
        <div className="detail-panel">
          {selected && (
            <>
              <div className="panel-label">
                {selectedKind === "post" ? "selected" : selectedKind}
              </div>
              <div className="selected-title">{selected.title}</div>

              {selectedKind === "post" && (
                <>
                  <div className="selected-meta">{selected.category}</div>
                  <div className="selected-tags">
                    {(selected.tags ?? []).map((t) => (
                      <span key={t} className="tag">#{t}</span>
                    ))}
                  </div>
                  <Link href={`/${selected.slug}`} className="open-link">
                    → open post
                  </Link>
                </>
              )}

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

              <div className="panel-label" style={{ marginTop: 20 }}>controls</div>
              <div className="control-row">
                <label>
                  repulsion
                  <span className="control-val">{repulsion}</span>
                </label>
                <input
                  type="range" min={0} max={100} step={1}
                  value={repulsion}
                  onChange={(e) => setRepulsion(Number(e.target.value))}
                />
              </div>
              <div className="control-row">
                <label>
                  centering
                  <span className="control-val">{centering.toFixed(2)}</span>
                </label>
                <input
                  type="range" min={0} max={0.2} step={0.01}
                  value={centering}
                  onChange={(e) => setCentering(Number(e.target.value))}
                />
              </div>
              <div className="control-row">
                <label>
                  link-dist
                  <span className="control-val">{linkDistance}</span>
                </label>
                <input
                  type="range" min={10} max={200} step={5}
                  value={linkDistance}
                  onChange={(e) => setLinkDistance(Number(e.target.value))}
                />
              </div>
              <div className="control-row">
                <label>
                  tension
                  <span className="control-val">{linkStrength.toFixed(1)}</span>
                </label>
                <input
                  type="range" min={0} max={3} step={0.1}
                  value={linkStrength}
                  onChange={(e) => setLinkStrength(Number(e.target.value))}
                />
              </div>
              <div className="control-buttons">
                <button type="button" className="control-btn" onClick={handleResetView}>
                  reset view
                </button>
                <button type="button" className="control-btn" onClick={handleResetForce}>
                  reset force
                </button>
              </div>

              <div className="panel-label" style={{ marginTop: 20 }}>timeline</div>
              <div className="anim-progress">
                <div
                  className="anim-bar"
                  style={{
                    width: animRevealCount === null
                      ? "100%"
                      : `${(animRevealCount / Math.max(postCount, 1)) * 100}%`,
                  }}
                />
                <span className="anim-label">
                  {animRevealCount === null
                    ? `${postCount} / ${postCount} posts`
                    : `${animRevealCount} / ${postCount} posts`}
                </span>
              </div>
              <div className="control-row" style={{ marginTop: 6 }}>
                <label>
                  speed
                  <span className="control-val">{animSpeed} posts/s</span>
                </label>
                <input
                  type="range" min={1} max={50} step={1}
                  value={animSpeed}
                  onChange={(e) => setAnimSpeed(Number(e.target.value))}
                />
              </div>
              <div className="control-buttons">
                <button
                  type="button"
                  className={`control-btn${isPlaying ? " active" : ""}`}
                  onClick={handlePlayAnim}
                >
                  {isPlaying ? "⏸ pause" : "▶ play"}
                </button>
                <button type="button" className="control-btn" onClick={handleResetAnim}>
                  ■ reset
                </button>
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
      pointer-events: none;
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

  .control-row {
    display: flex;
    flex-direction: column;
    gap: 4px;
    margin-bottom: 8px;

    label {
      font-size: 11px;
      color: ${({ theme }) => theme.colors.editor.fg2};
      display: flex;
      justify-content: space-between;
    }

    .control-val {
      color: ${({ theme }) => theme.colors.editor.accent3};
      font-variant-numeric: tabular-nums;
    }

    input[type="range"] {
      width: 100%;
      accent-color: ${({ theme }) => theme.colors.editor.accent};
    }
  }

  .control-buttons {
    display: flex;
    gap: 6px;
    margin-top: 4px;
  }

  .control-btn {
    flex: 1;
    padding: 4px 8px;
    background: ${({ theme }) => theme.colors.editor.bg};
    border: 1px solid ${({ theme }) => theme.colors.editor.line};
    color: ${({ theme }) => theme.colors.editor.fg2};
    font-family: inherit;
    font-size: 10px;
    cursor: pointer;
    transition: border-color 0.12s, color 0.12s;

    &:hover {
      border-color: ${({ theme }) => theme.colors.editor.accent};
      color: ${({ theme }) => theme.colors.editor.accent};
    }

    &.active {
      border-color: ${({ theme }) => theme.colors.editor.accent};
      color: ${({ theme }) => theme.colors.editor.accent};
      background: ${({ theme }) => theme.colors.editor.accentSoft};
    }
  }

  .anim-progress {
    position: relative;
    height: 18px;
    background: ${({ theme }) => theme.colors.editor.bg};
    border: 1px solid ${({ theme }) => theme.colors.editor.line};
    overflow: hidden;

    .anim-bar {
      position: absolute;
      inset: 0;
      height: 100%;
      background: ${({ theme }) => theme.colors.editor.accentSoft};
      transition: width 0.1s linear;
    }

    .anim-label {
      position: relative;
      z-index: 1;
      font-size: 9px;
      color: ${({ theme }) => theme.colors.editor.fg3};
      padding: 0 6px;
      line-height: 18px;
      display: block;
    }
  }
`
