import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import styled from "@emotion/styled"
import dynamic from "next/dynamic"
import Link from "next/link"
import { useIsFetching, useQuery } from "@tanstack/react-query"
import useNotionGraphQuery from "src/hooks/useNotionGraphQuery"
import useOntologyQuery from "src/hooks/useOntologyQuery"
import { queryKey } from "src/constants/queryKey"
import { useRegisterChrome } from "src/layouts/RootLayout/EditorChrome/RouteChromeContext"
import { DEFAULT_LAYOUT, RELATION_STYLES } from "./types"
import type { GraphLayoutOptions, SceneLink } from "./types"
import type { SimilarPost } from "src/pages/api/similar"

const GraphScene = dynamic(() => import("./GraphScene"), {
  ssr: false,
  loading: () => <div className="graph-message" role="status">Preparing the 3D view…</div>,
})

const LAYOUT_CONTROLS: {
  key: keyof GraphLayoutOptions
  label: string
  min: number
  max: number
  step: number
}[] = [
  { key: "postRepulsion", label: "Post repulsion", min: 50, max: 900, step: 10 },
  { key: "hubRepulsion", label: "Hub repulsion", min: 0, max: 140, step: 5 },
  { key: "hubRingRadius", label: "Hub radius", min: 0.2, max: 0.7, step: 0.01 },
  { key: "hubLinkStrength", label: "Hub attraction", min: 0, max: 0.3, step: 0.01 },
  { key: "linkDistance", label: "Post link distance", min: 20, max: 180, step: 4 },
]

const Graph = () => {
  const graph = useNotionGraphQuery()
  const { ontology, isLoading: ontologyLoading } = useOntologyQuery()
  const isFetching = useIsFetching({ queryKey: queryKey.notionGraph() }) > 0
  const { nodes, edges, cats } = graph
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [hoveredIndex, setHoveredIndex] = useState(-1)
  const [category, setCategory] = useState<string | null>(null)
  const [hoverCategory, setHoverCategory] = useState<string | null>(null)
  const [layoutOptions, setLayoutOptions] = useState<GraphLayoutOptions>(DEFAULT_LAYOUT)
  const [showReferences, setShowReferences] = useState(true)
  const [showTags, setShowTags] = useState(true)
  const [showSeries, setShowSeries] = useState(true)
  const [showLogical, setShowLogical] = useState(true)
  const [showSimilar, setShowSimilar] = useState(false)
  const [simThreshold, setSimThreshold] = useState(0.65)
  const [neighborhoodOnly, setNeighborhoodOnly] = useState(false)
  const [resetViewToken, setResetViewToken] = useState(0)
  const [focusRequest, setFocusRequest] = useState<{ index: number; token: number } | null>(null)
  const focusToken = useRef(0)
  const [search, setSearch] = useState("")
  const [searchMode, setSearchMode] = useState<"name" | "meaning">("name")
  const [semanticQuery, setSemanticQuery] = useState("")
  const semanticSearch = useQuery<{ results: SimilarPost[] }>({
    queryKey: ["graph-semantic-search", semanticQuery],
    enabled: searchMode === "meaning" && Boolean(semanticQuery) && graph.embedding?.searchAvailable === true,
    queryFn: async ({ signal }) => {
      const response = await fetch(`/api/graph/search?q=${encodeURIComponent(semanticQuery)}`, { signal, cache: "no-store" })
      const data = await response.json()
      if (!response.ok) throw new Error(data.error ?? "Semantic search is unavailable")
      return data
    },
    staleTime: 0,
    retry: false,
    refetchOnWindowFocus: false,
  })
  const [isPlaying, setIsPlaying] = useState(false)
  const [animSpeed, setAnimSpeed] = useState(5)
  const [revealCount, setRevealCount] = useState<number | null>(null)
  const timelinePosition = useRef(0)
  const selectedIndex = nodes.findIndex((node) => node.id === selectedId)
  const effectiveNeighborhoodOnly = neighborhoodOnly && selectedIndex >= 0
  const selected = nodes[selectedIndex]
  const highlightedCategory = hoverCategory ?? category

  const nodeIndexById = useMemo(() => new Map(nodes.map((node, index) => [node.id, index])), [nodes])
  const categoryColors = useMemo(() => {
    const colors: Record<string, string> = {}
    for (const node of nodes) {
      if (node.kind === "post" && node.category) colors[node.category] = node.color
    }
    return colors
  }, [nodes])

  const semanticLinks = useMemo<SceneLink[]>(() => {
    const logical = (ontology?.edges ?? []).flatMap(edge => {
      const a = nodeIndexById.get(edge.source)
      const b = nodeIndexById.get(edge.target)
      if (a === undefined || b === undefined || a === b || edge.kind === "similar-topic") return []
      return [{ a, b, kind: edge.kind, weight: 1, confidence: edge.confidence, rationale: edge.rationale }]
    })
    const similarities = (graph.embedding?.similarities ?? []).flatMap(pair => {
      const a = nodeIndexById.get(pair.source)
      const b = nodeIndexById.get(pair.target)
      if (a === undefined || b === undefined) return []
      return [{ a, b, kind: "similar-topic" as const, weight: 1, similarity: pair.score }]
    })
    return [...logical, ...similarities]
  }, [ontology, nodeIndexById, graph.embedding])

  const links = useMemo<SceneLink[]>(() => [
    ...edges
      .filter((edge) => edge.type === "has-tag" ? showTags : edge.type === "in-series" ? showSeries : showReferences)
      .map((edge) => ({ a: edge.a, b: edge.b, kind: edge.type, weight: edge.weight, contexts: edge.contexts })),
    ...semanticLinks.filter((edge) => edge.kind === "similar-topic"
      ? showSimilar && (edge.similarity ?? 0) >= simThreshold
      : showLogical),
  ], [edges, semanticLinks, showReferences, showTags, showSeries, showLogical, showSimilar, simThreshold])

  const { nodeAppearRank, postCount } = useMemo(() => {
    const ranks = new Array<number>(nodes.length).fill(Infinity)
    const posts = nodes
      .map((node, index) => ({ node, index }))
      .filter(({ node }) => node.kind === "post")
      .sort((a, b) => {
        if (!a.node.createdAt) return b.node.createdAt ? 1 : a.index - b.index
        if (!b.node.createdAt) return -1
        return a.node.createdAt.localeCompare(b.node.createdAt) || a.index - b.index
      })
    posts.forEach(({ index }, rank) => { ranks[index] = rank })
    for (const edge of edges) {
      if (nodes[edge.a].kind === "post" && nodes[edge.b].kind !== "post") {
        ranks[edge.b] = Math.min(ranks[edge.b], ranks[edge.a])
      } else if (nodes[edge.b].kind === "post" && nodes[edge.a].kind !== "post") {
        ranks[edge.a] = Math.min(ranks[edge.a], ranks[edge.b])
      }
    }
    for (let index = 0; index < ranks.length; index += 1) {
      if (ranks[index] === Infinity) ranks[index] = Math.max(0, posts.length - 1)
    }
    return { nodeAppearRank: ranks, postCount: posts.length }
  }, [nodes, edges])

  const activeFocus = selectedIndex >= 0 && neighborhoodOnly
    ? selectedIndex
    : hoveredIndex >= 0 ? hoveredIndex : selectedIndex
  const focusNeighbors = useMemo(() => {
    if (activeFocus < 0 || activeFocus >= nodes.length) return null
    const neighbors = new Set<number>([activeFocus])
    for (const link of links) {
      if (link.a === activeFocus) neighbors.add(link.b)
      else if (link.b === activeFocus) neighbors.add(link.a)
    }
    return neighbors
  }, [activeFocus, links, nodes.length])

  const connectedNodes = useMemo(() => {
    const neighbors = new Map<number, { index: number; relations: SceneLink[]; weight: number }>()
    if (selectedIndex < 0) return []
    for (const link of links) {
      const index = link.a === selectedIndex ? link.b : link.b === selectedIndex ? link.a : -1
      if (index < 0 || (revealCount !== null && nodeAppearRank[index] >= revealCount)) continue
      const existing = neighbors.get(index)
      if (existing) {
        existing.relations.push(link)
        existing.weight += link.weight
      } else {
        neighbors.set(index, { index, relations: [link], weight: link.weight })
      }
    }
    return [...neighbors.values()].sort((a, b) =>
      Number(nodes[b.index].kind === "post") - Number(nodes[a.index].kind === "post")
      || b.weight - a.weight
      || nodes[a.index].title.localeCompare(nodes[b.index].title)
    )
  }, [selectedIndex, links, nodes, revealCount, nodeAppearRank])

  const searchResults = useMemo<{ index: number; score?: number }[]>(() => {
    const query = search.trim().toLocaleLowerCase()
    if (!query) return []
    if (searchMode === "meaning") {
      if (semanticQuery !== search.trim()) return []
      return (semanticSearch.data?.results ?? []).flatMap(result => {
        const index = nodeIndexById.get(result.postId)
        return index !== undefined && (revealCount === null || nodeAppearRank[index] < revealCount)
          ? [{ index, score: result.score }] : []
      })
    }
    return nodes.flatMap((node, index) =>
      (revealCount === null || nodeAppearRank[index] < revealCount)
        && `${node.title} ${node.slug ?? ""} ${node.tags?.join(" ") ?? ""}`.toLocaleLowerCase().includes(query)
        ? [{ index }] : []
    ).slice(0, 10)
  }, [search, searchMode, semanticQuery, semanticSearch.data, nodeIndexById, nodes, revealCount, nodeAppearRank])

  const shownCounts = useMemo(() => {
    const visible = (index: number) =>
      (revealCount === null || nodeAppearRank[index] < revealCount)
      && (!effectiveNeighborhoodOnly || !focusNeighbors || focusNeighbors.has(index))
    return {
      nodes: nodes.reduce((count, _, index) => count + Number(visible(index)), 0),
      links: links.reduce((count, link) => count + Number(visible(link.a) && visible(link.b)), 0),
    }
  }, [nodes, links, revealCount, nodeAppearRank, effectiveNeighborhoodOnly, focusNeighbors])

  const statusItems = useMemo(() => [
    "3D graph", `${nodes.length} nodes`, `${edges.length} source relations`, "WebGL · perspective",
  ], [nodes.length, edges.length])
  useRegisterChrome("graph.md", statusItems, "graph")

  const handleSelect = useCallback((index: number) => {
    setSelectedId((previous) => index < 0 || nodes[index]?.id === previous ? null : nodes[index]?.id ?? null)
    setHoveredIndex(-1)
  }, [nodes])

  const focusNode = (index: number) => {
    setFocusRequest({ index, token: ++focusToken.current })
  }
  const clearSelection = () => {
    setSelectedId(null)
    setHoveredIndex(-1)
  }
  const chooseSearchResult = (index: number) => {
    setSelectedId(nodes[index].id)
    setHoveredIndex(-1)
    setSearch("")
    focusNode(index)
  }

  useEffect(() => {
    if (!isPlaying) return
    const interval = setInterval(() => {
      const next = Math.min(postCount, timelinePosition.current + 1)
      timelinePosition.current = next
      setRevealCount(next)
      if (next >= postCount) setIsPlaying(false)
    }, Math.max(50, Math.round(1000 / animSpeed)))
    return () => clearInterval(interval)
  }, [isPlaying, animSpeed, postCount])


  const playTimeline = () => {
    if (isPlaying) {
      setIsPlaying(false)
      return
    }
    timelinePosition.current = revealCount === null || revealCount >= postCount ? 0 : revealCount
    if (revealCount === null || revealCount >= postCount) {
      clearSelection()
      setRevealCount(0)
    }
    setIsPlaying(true)
  }

  const semanticAvailable = semanticLinks.length > 0

  return (
    <StyledWrapper>
      <div className="graph-layout">
        <div className="canvas-area">
          {nodes.length > 0 && (
          <GraphScene
            nodes={nodes}
            edges={edges}
            links={links}
            layoutOptions={layoutOptions}
            selectedIndex={selectedIndex}
            hoveredIndex={hoveredIndex}
            focusNeighbors={focusNeighbors}
            highlightedCategory={highlightedCategory}
            neighborhoodOnly={effectiveNeighborhoodOnly}
            nodeAppearRank={nodeAppearRank}
            revealCount={revealCount}
            resetViewToken={resetViewToken}
            focusRequest={focusRequest}
            onSelect={handleSelect}
            onHover={setHoveredIndex}
          />
          )}
          {!nodes.length && (
            <div className="graph-message" role="status">
              {isFetching ? "Loading graph data…" : "No graph data available. Check the content connection."}
            </div>
          )}

          <header className="graph-heading">
            <div className="heading-line"><h1>Knowledge graph</h1><span className="dimension">3D</span></div>
            <p>{shownCounts.nodes} nodes <span>·</span> {shownCounts.links} relations</p>
            {graph.embedding && <p className="embedding-status">
              {graph.embedding.embedded > 0 ? `EmbeddingGemma · PCA 3D · ${graph.embedding.embedded}/${graph.embedding.total} posts` : "Relationship layout · post embeddings pending"}
            </p>}
            <form className="graph-search" onSubmit={event => {
              event.preventDefault()
              if (!search.trim()) return
              if (searchMode === "meaning") {
                if (semanticQuery === search.trim()) void semanticSearch.refetch()
                else setSemanticQuery(search.trim())
              } else if (searchResults.length) chooseSearchResult(searchResults[0].index)
            }}>
              <div className="search-modes" aria-label="Graph search mode">
                <button type="button" aria-pressed={searchMode === "name"} onClick={() => setSearchMode("name")}>Name</button>
                <button type="button" aria-pressed={searchMode === "meaning"} disabled={!graph.embedding?.searchAvailable} onClick={() => setSearchMode("meaning")} title="Search post content with EmbeddingGemma">Meaning</button>
              </div>
              <div className="search-input">
                <input
                  type="search"
                  aria-label={searchMode === "meaning" ? "Search posts by meaning" : "Find a graph node"}
                  aria-controls="graph-search-results"
                  placeholder={searchMode === "meaning" ? "Describe what you want to find…" : "Find a post, tag, or series…"}
                  maxLength={8000}
                  value={search}
                  onChange={event => setSearch(event.target.value)}
                  onKeyDown={event => { if (event.key === "Escape") setSearch("") }}
                />
                {searchMode === "meaning" && <button type="submit" disabled={!search.trim() || semanticSearch.isFetching} aria-label="Run semantic search">↵</button>}
              </div>
              {search.trim() && (
                <div id="graph-search-results" className="search-results" aria-live="polite">
                  {searchMode === "meaning" && semanticQuery !== search.trim() ? <p>Press Enter to search post content.</p>
                    : searchMode === "meaning" && semanticSearch.isFetching ? <p role="status">Searching by meaning…</p>
                    : searchMode === "meaning" && semanticSearch.error ? <p role="status">{semanticSearch.error.message}</p>
                    : searchResults.length ? searchResults.map(({ index, score }) => (
                      <button type="button" key={nodes[index].id} onClick={() => chooseSearchResult(index)}>
                        <span className={`node-symbol ${nodes[index].kind}`} style={{ color: nodes[index].color }} />
                        <span>{nodes[index].title}<small>{score === undefined ? nodes[index].kind : `Cosine similarity ${score.toFixed(3)}`}</small></span>
                      </button>
                    )) : <p>{searchMode === "meaning" ? "No indexed posts match. Pending embeddings are filled during content reconciliation." : "No matching nodes."}</p>}
                </div>
              )}
            </form>
          </header>

          <div className={`floating-controls${selected ? " drawer-open" : ""}`}>
            <button type="button" className="control-btn reset-view" onClick={() => setResetViewToken((token) => token + 1)}>
              Reset view
            </button>
            <details className="control-popover">
              <summary>Graph controls</summary>
              <div className="control-popover-body">
                <div className="panel-label">Relations</div>
                <div className="relation-toggles">
                  {[
                    { label: "References", color: RELATION_STYLES.link.color, active: showReferences, toggle: () => setShowReferences((value) => !value) },
                    { label: "Tags", color: RELATION_STYLES["has-tag"].color, active: showTags, toggle: () => setShowTags((value) => !value) },
                    { label: "Series", color: RELATION_STYLES["in-series"].color, active: showSeries, toggle: () => setShowSeries((value) => !value) },
                  ].map((filter) => (
                    <button type="button" key={filter.label} aria-pressed={filter.active} onClick={filter.toggle}>
                      <span className="dot" style={{ background: filter.color }} />{filter.label}
                    </button>
                  ))}
                </div>
                <div className="panel-label section-label">Semantic overlay</div>
                <p className="control-note">Dashed relations are inferred, not explicit post links.</p>
                <div className="overlay-toggles">
                  <button type="button" aria-pressed={showLogical} disabled={!semanticLinks.some(edge => edge.kind !== "similar-topic")} onClick={() => setShowLogical(value => !value)}>Logical</button>
                  <button type="button" aria-pressed={showSimilar} disabled={!semanticLinks.some(edge => edge.kind === "similar-topic")} onClick={() => setShowSimilar(value => !value)}>Similar content</button>
                </div>
                {!semanticAvailable && <p className="control-note">{ontologyLoading ? "Loading semantic data…" : "No semantic relations available."}</p>}
                {showSimilar && (
                  <div className="control-row">
                    <label htmlFor="graph-similarity">Cosine threshold<span>{simThreshold.toFixed(2)}</span></label>
                    <input id="graph-similarity" type="range" min={0.3} max={0.95} step={0.01} value={simThreshold} onChange={event => setSimThreshold(Number(event.target.value))} />
                  </div>
                )}

                <div className="panel-label section-label">Categories</div>
                <div className="cat-filters">
                  {cats.filter(Boolean).map((cat) => (
                    <button
                      type="button"
                      key={cat}
                      aria-pressed={category === cat}
                      onClick={() => setCategory((current) => current === cat ? null : cat)}
                      onMouseEnter={() => setHoverCategory(cat)}
                      onMouseLeave={() => setHoverCategory(null)}
                      onFocus={() => setHoverCategory(cat)}
                      onBlur={() => setHoverCategory(null)}
                    >
                      <span className="dot" style={{ background: categoryColors[cat] }} />{cat}
                    </button>
                  ))}
                </div>
                <div className="panel-label section-label">3D layout</div>
                <p className="control-note">Indexed posts keep their PCA positions; force controls adjust hubs and posts awaiting embeddings. Nearby points approximate content similarity, not an explicit relation.</p>
                {LAYOUT_CONTROLS.map((control) => (
                  <div className="control-row" key={control.key}>
                    <label htmlFor={`graph-${control.key}`}>
                      {control.label}<span>{control.step < 1 ? layoutOptions[control.key].toFixed(2) : layoutOptions[control.key]}</span>
                    </label>
                    <input
                      id={`graph-${control.key}`}
                      type="range"
                      min={control.min}
                      max={control.max}
                      step={control.step}
                      value={layoutOptions[control.key]}
                      onChange={(event) => setLayoutOptions((current) => ({ ...current, [control.key]: Number(event.target.value) }))}
                    />
                  </div>
                ))}
                <button type="button" className="control-btn" onClick={() => setLayoutOptions({ ...DEFAULT_LAYOUT })}>Reset layout</button>

                <div className="panel-label section-label">Timeline</div>
                <div className="timeline-progress">
                  <progress value={revealCount ?? postCount} max={Math.max(1, postCount)} aria-label="Revealed posts" />
                  <span>{Math.min(revealCount ?? postCount, postCount)} / {postCount} posts</span>
                </div>
                <div className="control-row">
                  <label htmlFor="graph-timeline-speed">Speed<span>{animSpeed} posts/s</span></label>
                  <input id="graph-timeline-speed" type="range" min={1} max={50} step={1} value={animSpeed} onChange={(event) => setAnimSpeed(Number(event.target.value))} />
                </div>
                <div className="control-buttons">
                  <button type="button" className="control-btn" disabled={!postCount} onClick={playTimeline}>{isPlaying ? "Pause" : "Play"}</button>
                  <button type="button" className="control-btn" onClick={() => { setIsPlaying(false); clearSelection(); setRevealCount(0) }}>Rewind</button>
                  <button type="button" className="control-btn" onClick={() => { setIsPlaying(false); setRevealCount(null) }}>Show all</button>
                </div>
              </div>
            </details>
          </div>

          <div className="graph-legend" aria-label="Graph legend">
            <span><i className="node-symbol post" />Post</span>
            <span><i className="node-symbol tag" />Tag</span>
            <span><i className="node-symbol series" />Series</span>
            <span className="legend-divider" />
            <span><i className="edge-key" />Explicit</span>
            <span title="Inferred from the available ontology"><i className="edge-key inferred" />Inferred</span>
          </div>
          <div className="interaction-hint">
            <span className="desktop-hint">Drag to rotate <b>·</b> Shift / right drag to pan <b>·</b> Scroll to zoom <b>·</b> Alt + drag a node</span>
            <span className="mobile-hint">One finger: rotate <b>·</b> Two fingers: pan / pinch to zoom</span>
          </div>
        </div>

        <aside className={`detail-panel${selected ? " is-open" : ""}`} aria-hidden={!selected} aria-label="Node relationships">
          {selected && (
            <>
              <button type="button" className="detail-close" onClick={clearSelection} aria-label="Close node details">×</button>
              <div className="panel-label">{selected.kind}</div>
              <h2 className="selected-title">{selected.title}</h2>
              {selected.kind === "post" && (
                <>
                  <div className="selected-meta">{selected.category}{selected.readTime ? ` · ${selected.readTime} min read` : ""}</div>
                  <div className="selected-tags">{(selected.tags ?? []).map((tag) => <span key={tag}>#{tag}</span>)}</div>
                  {selected.slug && <Link href={`/${selected.slug}`} className="open-link">Open post →</Link>}
                </>
              )}
              <div className="selection-actions">
                <button type="button" className="control-btn" onClick={() => focusNode(selectedIndex)}>Focus node</button>
                <button type="button" className="control-btn" aria-pressed={neighborhoodOnly} onClick={() => setNeighborhoodOnly((value) => !value)}>Connections only</button>
              </div>
              <div className="panel-label section-label">Connected · {connectedNodes.length}</div>
              <p className="control-note">Arrows show source → target. Node size reflects its connection count.</p>
              {!connectedNodes.length && <p className="empty-connections">No connections in the current view. Enable relation layers to see more.</p>}
              <div className="connected-list">
                {connectedNodes.map(({ index, relations }) => (
                  <div className="connected-item" key={nodes[index].id}>
                    <button
                      type="button"
                      className="connected-title"
                      onClick={() => { setSelectedId(nodes[index].id); setHoveredIndex(-1) }}
                      onMouseEnter={() => setHoveredIndex(index)}
                      onMouseLeave={() => setHoveredIndex(-1)}
                      onFocus={() => setHoveredIndex(index)}
                      onBlur={() => setHoveredIndex(-1)}
                    >
                      <span className={`node-symbol ${nodes[index].kind}`} style={{ color: nodes[index].color }} />
                      {nodes[index].title}
                    </button>
                    {relations.map((relation, relationIndex) => (
                      <div className="relation-detail" key={`${relation.kind}-${relation.a}-${relation.b}-${relationIndex}`}>
                        <div className="relation-caption" style={{ color: RELATION_STYLES[relation.kind].color }}>
                          <span>{relation.kind === "similar-topic" ? "↔" : relation.a === selectedIndex ? "→" : "←"} {RELATION_STYLES[relation.kind].label}</span>
                          <span className="relation-strength">{relation.similarity !== undefined ? `cosine ${relation.similarity.toFixed(3)}` : relation.confidence !== undefined ? `${Math.round(relation.confidence * 100)}% confidence` : relation.weight > 1 ? `×${relation.weight}` : ""}</span>
                        </div>
                        {relation.confidence !== undefined && <span className="inferred-note">Inferred relation</span>}
                        {relation.similarity !== undefined && <span className="inferred-note">Embedding similarity · not an explicit reference</span>}
                        {relation.rationale && <p className="relation-evidence">{relation.rationale}</p>}
                        {relation.contexts?.map((context, contextIndex) => <blockquote key={contextIndex} className="relation-evidence">{context}</blockquote>)}
                      </div>
                    ))}
                  </div>
                ))}
              </div>
            </>
          )}
        </aside>
      </div>
    </StyledWrapper>
  )
}

export default Graph

const StyledWrapper = styled.div`
  display: flex;
  flex-direction: column;
  height: calc(100dvh - ${({ theme }) => theme.variables.titleBarHeight + theme.variables.tabBarHeight + theme.variables.statusBarHeight}px);
  overflow: hidden;
  font-family: var(--font-mono, monospace);
  color: ${({ theme }) => theme.colors.editor.fg};

  .graph-layout { position: relative; flex: 1; min-height: 0; isolation: isolate; }
  .canvas-area { position: relative; height: 100%; overflow: hidden; background: ${({ theme }) => theme.colors.editor.bg}; }
  .graph-message { position: absolute; inset: 0; display: grid; place-content: center; padding: 24px; text-align: center; color: ${({ theme }) => theme.colors.editor.fg2}; font-size: 12px; pointer-events: none; }
  button, summary, input, a { &:focus-visible { outline: 2px solid ${({ theme }) => theme.colors.editor.accent}; outline-offset: 3px; } }
  button { font-family: inherit; cursor: pointer; }
  button:disabled { opacity: 0.4; cursor: not-allowed; }
  button, a { transition: color 0.16s, background 0.16s, border-color 0.16s; }
  button:active:not(:disabled) { transform: translateY(1px); }

  .graph-heading { position: absolute; top: 22px; left: 24px; z-index: 2; pointer-events: none; }
  .heading-line { display: flex; gap: 10px; align-items: center; }
  h1 { margin: 0; font-size: 15px; font-weight: 500; letter-spacing: -0.4px; }
  .dimension { color: ${({ theme }) => theme.colors.editor.accent}; font-size: 10px; padding: 2px 5px; border: 1px solid ${({ theme }) => theme.colors.editor.line}; }
  .graph-heading > p { margin: 7px 0 14px; font-size: 10px; font-variant-numeric: tabular-nums; color: ${({ theme }) => theme.colors.editor.fg3}; span { margin: 0 5px; } }
  .graph-search { width: 256px; position: relative; pointer-events: auto; }
  .graph-search input { width: 100%; padding: 9px 10px; font: 10px var(--font-mono, monospace); background: ${({ theme }) => theme.colors.editor.bg2}; color: ${({ theme }) => theme.colors.editor.fg}; border: 1px solid ${({ theme }) => theme.colors.editor.line}; border-radius: 0; }
  .graph-heading > p.embedding-status { margin-top: -6px; margin-bottom: 10px; font-size: 9px; }
  .search-modes { display: flex; gap: 4px; margin-bottom: 5px; }
  .search-modes button { padding: 3px 8px; font-size: 9px; color: ${({ theme }) => theme.colors.editor.fg3}; border: 1px solid transparent; background: transparent; }
  .search-input { display: flex; }
  .search-input input { min-width: 0; flex: 1; }
  .search-input > button { padding: 0 10px; border: 1px solid ${({ theme }) => theme.colors.editor.line}; border-left: 0; background: ${({ theme }) => theme.colors.editor.bg2}; color: ${({ theme }) => theme.colors.editor.fg2}; }
  .search-input > button:disabled { opacity: 0.5; }
  .search-results { position: absolute; top: calc(100% + 4px); left: 0; width: 100%; max-height: 360px; overflow-y: auto; background: ${({ theme }) => theme.colors.editor.bg2}; border: 1px solid ${({ theme }) => theme.colors.editor.line}; box-shadow: 0 8px 24px rgba(0,0,0,0.12); }
  .search-results button { display: flex; align-items: flex-start; gap: 9px; padding: 10px; width: 100%; text-align: left; border: none; background: transparent; color: ${({ theme }) => theme.colors.editor.fg2}; font-size: 11px; line-height: 1.5; }
  .search-results button:hover { background: ${({ theme }) => theme.colors.editor.bg}; color: ${({ theme }) => theme.colors.editor.accent}; }
  .search-results small { display: block; color: ${({ theme }) => theme.colors.editor.fg3}; font-size: 9px; margin-top: 3px; }
  .search-results p { padding: 0 12px; font-size: 11px; color: ${({ theme }) => theme.colors.editor.fg3}; }

  .floating-controls { position: absolute; display: flex; align-items: flex-start; gap: 6px; top: 20px; right: 20px; z-index: 4; transition: right 0.22s ease; }
  .floating-controls.drawer-open { right: 358px; }
  .reset-view { flex: none; white-space: nowrap; }
  .control-popover { width: 224px; background: ${({ theme }) => theme.colors.editor.bg2}; border: 1px solid ${({ theme }) => theme.colors.editor.line}; }
  .control-popover:not([open]) { width: 132px; }
  .control-popover summary { list-style: none; padding: 9px 10px; font-size: 10px; color: ${({ theme }) => theme.colors.editor.fg2}; cursor: pointer; user-select: none; &::-webkit-details-marker { display: none; } &::after { content: "+"; float: right; color: ${({ theme }) => theme.colors.editor.fg3}; } }
  .control-popover[open] { box-shadow: 0 10px 24px rgba(0,0,0,0.12); summary { border-bottom: 1px solid ${({ theme }) => theme.colors.editor.line}; &::after { content: "−"; } } }
  .control-popover-body { max-height: calc(100dvh - 150px); overflow-y: auto; padding: 12px; scrollbar-width: thin; }
  .panel-label { color: ${({ theme }) => theme.colors.editor.fg3}; font-size: 10px; letter-spacing: 0.6px; margin-bottom: 9px; }
  .section-label { margin-top: 22px; }
  .control-note { color: ${({ theme }) => theme.colors.editor.fg3}; font-size: 10px; line-height: 1.6; margin: 0 0 10px; }
  .control-row { display: flex; flex-direction: column; gap: 6px; margin-bottom: 12px; }
  .control-row label { display: flex; justify-content: space-between; color: ${({ theme }) => theme.colors.editor.fg2}; font-size: 10px; gap: 8px; }
  .control-row label span { color: ${({ theme }) => theme.colors.editor.accent3}; font-variant-numeric: tabular-nums; }
  .control-row input { width: 100%; accent-color: ${({ theme }) => theme.colors.editor.accent}; }
  .control-buttons, .overlay-toggles, .selection-actions { display: flex; gap: 6px; }
  .control-btn, .overlay-toggles button { flex: 1; padding: 8px; border: 1px solid ${({ theme }) => theme.colors.editor.line}; background: ${({ theme }) => theme.colors.editor.bg2}; color: ${({ theme }) => theme.colors.editor.fg2}; font-size: 10px; }
  .control-btn:hover:not(:disabled), .overlay-toggles button:hover:not(:disabled) { color: ${({ theme }) => theme.colors.editor.accent}; border-color: ${({ theme }) => theme.colors.editor.accent}; }
  button[aria-pressed="true"] { color: ${({ theme }) => theme.colors.editor.accent}; border-color: ${({ theme }) => theme.colors.editor.accent}; background: ${({ theme }) => theme.colors.editor.accentSoft}; }
  .relation-toggles, .cat-filters { display: flex; flex-wrap: wrap; gap: 5px; }
  .relation-toggles button, .cat-filters button { display: flex; align-items: center; gap: 5px; padding: 6px 7px; font-size: 10px; border: 1px solid ${({ theme }) => theme.colors.editor.line}; background: ${({ theme }) => theme.colors.editor.bg}; color: ${({ theme }) => theme.colors.editor.fg2}; }
  .dot { width: 6px; height: 6px; border-radius: 50%; flex-shrink: 0; }
  .cat-filters button[aria-pressed="true"], .relation-toggles button[aria-pressed="true"] { border-color: ${({ theme }) => theme.colors.editor.accent}; }
  .timeline-progress { display: grid; gap: 6px; margin-bottom: 14px; color: ${({ theme }) => theme.colors.editor.fg3}; font-size: 10px; font-variant-numeric: tabular-nums; }
  .timeline-progress progress { width: 100%; height: 4px; accent-color: ${({ theme }) => theme.colors.editor.accent}; }

  .node-symbol { display: inline-block; width: 7px; height: 7px; margin-top: 3px; flex-shrink: 0; background: currentColor; }
  .node-symbol.post { border-radius: 50%; }
  .node-symbol.tag { transform: rotate(45deg); color: ${RELATION_STYLES["has-tag"].color}; }
  .node-symbol.series { transform: rotate(45deg); border: 1px solid currentColor; background: transparent; color: ${RELATION_STYLES["in-series"].color}; }
  .graph-legend { position: absolute; bottom: 45px; left: 24px; display: flex; gap: 14px; align-items: center; color: ${({ theme }) => theme.colors.editor.fg2}; font-size: 9px; pointer-events: none; }
  .graph-legend > span { display: inline-flex; align-items: center; gap: 6px; }
  .graph-legend .node-symbol { margin: 0; }
  .legend-divider { height: 12px; border-left: 1px solid ${({ theme }) => theme.colors.editor.line}; }
  .edge-key { width: 17px; border-top: 1px solid ${RELATION_STYLES.link.color}; }
  .edge-key.inferred { border-top-style: dashed; border-top-color: ${({ theme }) => theme.colors.editor.fg3}; }
  .interaction-hint { position: absolute; bottom: 19px; left: 24px; color: ${({ theme }) => theme.colors.editor.fg3}; font-size: 9px; pointer-events: none; b { margin: 0 6px; font-weight: 400; color: ${({ theme }) => theme.colors.editor.fg4}; } }
  .mobile-hint { display: none; }

  .detail-panel { position: absolute; inset: 0 0 0 auto; width: 338px; padding: 24px 20px; box-sizing: border-box; z-index: 5; background: ${({ theme }) => theme.colors.editor.bg2}; border-left: 1px solid ${({ theme }) => theme.colors.editor.line}; overflow-y: auto; scrollbar-width: thin; pointer-events: none; visibility: hidden; opacity: 0; transform: translateX(100%); transition: transform 0.24s ease, opacity 0.18s ease, visibility 0s linear 0.24s; }
  .detail-panel.is-open { pointer-events: auto; visibility: visible; opacity: 1; transform: translateX(0); transition-delay: 0s; }
  .detail-close { position: absolute; top: 14px; right: 14px; padding: 2px 6px; border: 1px solid ${({ theme }) => theme.colors.editor.line}; background: transparent; color: ${({ theme }) => theme.colors.editor.fg3}; font-size: 16px; }
  .detail-close:hover { color: ${({ theme }) => theme.colors.editor.accent}; }
  .selected-title { color: ${({ theme }) => theme.colors.editor.fg}; font-size: 18px; font-weight: 500; line-height: 1.45; letter-spacing: -0.4px; margin: 0 14px 8px 0; overflow-wrap: anywhere; }
  .selected-meta { color: ${({ theme }) => theme.colors.editor.fg3}; font-size: 10px; margin-bottom: 12px; }
  .selected-tags { display: flex; flex-wrap: wrap; gap: 5px 9px; margin-bottom: 12px; color: ${({ theme }) => theme.colors.editor.accent3}; font-size: 10px; }
  .open-link { display: inline-block; margin: 0 0 18px; color: ${({ theme }) => theme.colors.editor.accent}; text-decoration: none; font-size: 11px; &:hover { color: ${({ theme }) => theme.colors.editor.accent3}; } }
  .selection-actions { margin: 14px 0 0; }
  .connected-item { border-bottom: 1px solid ${({ theme }) => theme.colors.editor.line}; padding: 12px 0; }
  .connected-title { display: flex; align-items: flex-start; gap: 8px; width: 100%; border: none; padding: 0; background: transparent; color: ${({ theme }) => theme.colors.editor.fg2}; font-size: 11px; line-height: 1.6; text-align: left; &:hover { color: ${({ theme }) => theme.colors.editor.accent}; } .node-symbol { margin-top: 5px; } }
  .relation-detail { padding-left: 15px; margin-top: 6px; }
  .relation-caption { display: flex; flex-wrap: wrap; gap: 4px 8px; font-size: 9px; line-height: 1.5; }
  .relation-strength { color: ${({ theme }) => theme.colors.editor.fg3}; font-variant-numeric: tabular-nums; }
  .inferred-note { color: ${({ theme }) => theme.colors.editor.fg3}; font-size: 8px; }
  .relation-evidence { color: ${({ theme }) => theme.colors.editor.fg2}; font-size: 10px; line-height: 1.7; margin: 6px 0 0; overflow-wrap: anywhere; }
  blockquote.relation-evidence { border-left: 2px solid ${({ theme }) => theme.colors.editor.line}; padding-left: 8px; }
  .empty-connections { color: ${({ theme }) => theme.colors.editor.fg3}; font-size: 11px; line-height: 1.7; }

  @media (max-width: 1100px) { .floating-controls.drawer-open .reset-view { visibility: hidden; } }
  @media (max-width: ${({ theme }) => theme.variables.breakpoint}px) {
    .graph-heading { top: 16px; left: 14px; }
    h1 { font-size: 12px; }
    .graph-search { width: min(222px, calc(100vw - 132px)); }
    .floating-controls, .floating-controls.drawer-open { top: 14px; right: 10px; }
    .floating-controls .reset-view { display: none; }
    .control-popover:not([open]) { width: 108px; }
    .control-popover summary { font-size: 9px; }
    .floating-controls.drawer-open .control-popover { display: block; }
    .control-popover-body { max-height: calc(100dvh - 210px); }
    .graph-legend { bottom: 40px; left: 14px; gap: 10px; font-size: 8px; }
    .interaction-hint { bottom: 17px; left: 14px; right: 10px; font-size: 8px; }
    .desktop-hint { display: none; }
    .mobile-hint { display: inline; }
    .detail-panel { inset: auto 0 0; width: 100%; max-height: 43%; border-left: 0; border-top: 1px solid ${({ theme }) => theme.colors.editor.line}; padding: 18px; transform: translateY(100%); }
    .detail-panel.is-open { transform: translateY(0); }
  }
  @media (prefers-reduced-motion: reduce) { button, a, .floating-controls, .detail-panel { transition: none; } }
`
