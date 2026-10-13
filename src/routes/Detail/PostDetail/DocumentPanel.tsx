import { useMemo, useState } from "react"
import Link from "next/link"
import styled from "@emotion/styled"
import { CONFIG } from "site.config"
import type { TPost } from "src/types"
import usePostsQuery from "src/hooks/usePostsQuery"
import useNotionGraphQuery from "src/hooks/useNotionGraphQuery"
import useSimilarPostsQuery from "src/hooks/useSimilarPostsQuery"
import { getPostEgoGraph } from "src/libs/utils/graph"
import { useWorkbench } from "src/layouts/RootLayout/EditorChrome/WorkbenchContext"
import WorkbenchIcon from "src/components/WorkbenchIcon"
import CommentBox from "./CommentBox"
import PostEgoGraph from "./PostEgoGraph"

const DocumentPanel = ({ post }: { post: TPost }) => {
  const { isPanelOpen, setPanelOpen, panelTab, setPanelTab, readingMode } = useWorkbench()
  const [commentsOpened, setCommentsOpened] = useState(false)
  const [referencesOpened, setReferencesOpened] = useState(false)
  if (isPanelOpen && panelTab === "comments" && !commentsOpened) setCommentsOpened(true)
  if (isPanelOpen && panelTab === "references" && !referencesOpened) setReferencesOpened(true)
  return <Panel aria-label="Document panel" hidden={!isPanelOpen || readingMode}>
    <div className="panel-tabs" role="tablist" aria-label="Document context">
      <button id="document-references-tab" type="button" role="tab" aria-controls="document-references" aria-selected={panelTab === "references"} onClick={() => setPanelTab("references")}>References</button>
      <button id="document-comments-tab" type="button" role="tab" aria-controls="document-comments" aria-selected={panelTab === "comments"} onClick={() => setPanelTab("comments")}>Comments</button>
      <button type="button" className="panel-close" aria-label="Close document panel" onClick={() => setPanelOpen(false)}><WorkbenchIcon name="close" /></button>
    </div>
    <div className="panel-body">
      <div id="document-references" role="tabpanel" aria-labelledby="document-references-tab" hidden={panelTab !== "references"}>{referencesOpened && <References post={post} />}</div>
      <div id="document-comments" role="tabpanel" aria-labelledby="document-comments-tab" hidden={panelTab !== "comments"}>
        {commentsOpened && (CONFIG.notionComments.enable || CONFIG.utterances.enable || CONFIG.cusdis.enable ? <CommentBox data={post} /> : <p className="empty">Comments are not enabled for this site.</p>)}
      </div>
    </div>
  </Panel>
}

const References = ({ post }: { post: TPost }) => {
  const posts = usePostsQuery()
  const graph = useNotionGraphQuery()
  const { similar, isLoading } = useSimilarPostsQuery(post.id, 5)
  const linked = useMemo(() => getPostEgoGraph(graph.nodes, graph.edges, post.id)?.neighbors.filter(neighbor => neighbor.node.kind === "post" && Boolean(neighbor.node.slug) && neighbor.edges.some(edge => edge.type === "link" || edge.type === "mention" || edge.type === "link_to_page")) ?? [], [graph, post.id])
  const related = posts.filter(entry => entry.slug !== post.slug && entry.category?.[0] === post.category?.[0]).slice(0, 3)
  return <div className="references-grid">
    <section><h2>Explicit document links</h2><p className="hint">Direct links and mentions in the published graph, in either direction.</p>{linked.length ? linked.map(({ node, edges }) => <Link key={node.id} href={`/${node.slug}`} className="reference-link">{node.title}<span>{Array.from(new Set(edges.map(edge => edge.type))).join(" · ")}</span></Link>) : <p className="empty">No direct document links in the current graph.</p>}<details><summary>Direct relationship graph</summary><PostEgoGraph post={post} /></details></section>
    <section><h2>Related by category</h2><p className="hint">Shared category, not an explicit citation.</p>{related.length ? related.map(entry => <Link key={entry.slug} href={`/${entry.slug}`} className="reference-link">{entry.title}</Link>) : <p className="empty">No other articles in this category.</p>}</section>
    <section><h2>AI · similar articles</h2><p className="hint">Inferred content similarity, not an explicit reference.</p>{isLoading && <p role="status" className="empty">Loading similar articles…</p>}{similar.map(entry => <div key={entry.postId}><Link href={`/${entry.slug}`} className="reference-link">{entry.title}</Link>{entry.rationale && <p className="hint rationale">{entry.rationale}</p>}</div>)}{!isLoading && !similar.length && <p className="empty">No similarity suggestions available.</p>}</section>
  </div>
}

export default DocumentPanel
const Panel = styled.section`
  border-top: 1px solid ${({ theme }) => theme.colors.editor.line};
  background: ${({ theme }) => theme.colors.editor.bg2};
  font-size: 13px;
  .panel-tabs { display: flex; align-items: center; min-height: 36px; border-bottom: 1px solid ${({ theme }) => theme.colors.editor.line}; }
  .panel-tabs button { padding: 10px 14px; border: 0; border-bottom: 1px solid transparent; background: none; color: ${({ theme }) => theme.colors.editor.fg3}; cursor: pointer; font-size: 11px; }
  .panel-tabs button[aria-selected="true"] { color: ${({ theme }) => theme.colors.editor.fg}; border-bottom-color: ${({ theme }) => theme.colors.editor.accent}; }
  .panel-tabs .panel-close { margin-left: auto; display: flex; }
  .panel-tabs button:focus-visible, summary:focus-visible { outline: 2px solid ${({ theme }) => theme.colors.editor.accent}; outline-offset: -2px; }
  .panel-body { padding: 18px 24px 28px; }
  .references-grid { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 28px; }
  h2 { font-size: 12px; font-weight: 600; margin: 0 0 8px; color: ${({ theme }) => theme.colors.editor.fg}; }
  .hint, .empty { color: ${({ theme }) => theme.colors.editor.fg3}; font-size: 11px; line-height: 1.6; margin: 0 0 12px; }
  .reference-link { display: block; padding: 6px 0; color: ${({ theme }) => theme.colors.editor.fg2}; text-decoration: none; line-height: 1.6; }
  .reference-link:hover { color: ${({ theme }) => theme.colors.editor.accent}; }
  .reference-link span { display: block; font-size: 10px; color: ${({ theme }) => theme.colors.editor.fg3}; }
  details { margin-top: 12px; }
  summary { cursor: pointer; font-size: 11px; color: ${({ theme }) => theme.colors.editor.fg2}; margin-bottom: 8px; }
  @media (max-width: 960px) { .references-grid { grid-template-columns: 1fr; gap: 20px; } .panel-body { padding: 18px; } }
`
