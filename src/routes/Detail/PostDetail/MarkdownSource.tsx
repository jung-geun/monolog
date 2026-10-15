import { useEffect, useMemo, useState } from "react"
import styled from "@emotion/styled"
import Prism from "prismjs"
import type { Token } from "prismjs"
import "prismjs/components/prism-markdown"
import { markdownUrl } from "src/libs/seo"
import type { DocumentContext } from "src/layouts/RootLayout/EditorChrome/WorkbenchContext"
import type { MarkdownSourceMap } from "src/libs/utils/notion/markdown"

type Props = { slug: string; headings: DocumentContext["headings"] }
type SourceState = { status: "loading" | "error"; message?: string } | { status: "ready"; text: string; blocks: MarkdownSourceMap }

// Preview code is highlighted explicitly; automatic DOM highlighting would
// destroy the React-owned source rows even before the layout observer runs.
Prism.manual = true

// Keep multiline Prism tokens intact while giving each actual source line its own row.
function tokenLines(token: string | Token): string[] {
  if (typeof token === "string") return token.split("\n").map(line => line.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;"))
  const content = Array.isArray(token.content) ? token.content : [token.content]
  const lines = [""]
  for (const child of content) {
    const parts = tokenLines(child)
    lines[lines.length - 1] += parts[0]
    lines.push(...parts.slice(1))
  }
  const aliases = token.alias ? (Array.isArray(token.alias) ? token.alias : [token.alias]) : []
  return lines.map(line => `<span class="token ${[token.type, ...aliases].join(" ")}">${line}</span>`)
}

const MarkdownSource = ({ slug, headings }: Props) => {
  const [state, setState] = useState<SourceState>({ status: "loading" })
  const [attempt, setAttempt] = useState(0)
  const href = markdownUrl(slug)
  useEffect(() => {
    const controller = new AbortController()
    const load = async () => {
      try {
        const response = await fetch(`/api/markdown/${encodeURIComponent(slug)}?sourceMap=1`, { signal: controller.signal, mode: "same-origin" })
        if (!response.ok) throw new Error(`HTTP ${response.status}`)
        const document: { markdown: string; blocks: MarkdownSourceMap } = await response.json()
        if (!controller.signal.aborted) setState({ status: "ready", text: document.markdown, blocks: document.blocks })
      } catch (error) {
        if (!controller.signal.aborted) setState({ status: "error", message: error instanceof Error ? error.message : "Request failed" })
      }
    }
    void load()
    return () => controller.abort()
  }, [slug, attempt])

  const rendered = useMemo(() => {
    if (state.status !== "ready") return null
    const highlighted = [""]
    for (const token of Prism.tokenize(state.text, Prism.languages.markdown)) {
      const parts = tokenLines(token)
      highlighted[highlighted.length - 1] += parts[0]
      highlighted.push(...parts.slice(1))
    }
    const headingIds = new Map<number, string>()
    const headingByBlock = new Map(headings.map(heading => [heading.id.replace(/-/g, "").toLowerCase(), heading.id]))
    for (const block of state.blocks) {
      const headingId = headingByBlock.get(block.blockId)
      if (headingId) headingIds.set(block.startLine - 1, headingId)
    }
    const blockIds = new Map<number, string>()
    // Parents cover descendants too: the narrowest exported span owns a row.
    for (const block of [...state.blocks].sort((a, b) => (b.endLine - b.startLine) - (a.endLine - a.startLine))) {
      for (let line = block.startLine; line <= block.endLine; line++) blockIds.set(line, block.blockId)
    }
    return { highlighted, headingIds, blockIds }
  }, [state, headings])

  return (
    <Source aria-label="Read-only Markdown source" aria-busy={state.status === "loading"}>
      <div className="source-caption">{slug}.md <span>Read-only · exported Markdown</span></div>
      {state.status === "loading" && <p role="status" className="source-state">Loading Markdown source…</p>}
      {state.status === "error" && <div role="alert" className="source-state"><p>Unable to load Markdown source ({state.message}). Preview remains available.</p><button type="button" onClick={() => { setState({ status: "loading" }); setAttempt(value => value + 1) }}>Retry</button> <a href={href} target="_blank" rel="noopener noreferrer">Open Markdown</a></div>}
      {rendered && <pre tabIndex={0} aria-label="Markdown source with line numbers"><code className="language-markdown">{rendered.highlighted.map((html, index) => <span className="source-line" data-source-block={rendered.blockIds.get(index + 1)} data-source-heading={rendered.headingIds.get(index)} data-source-line={index + 1} key={index}><span className="source-number" aria-hidden="true">{index + 1}</span><span className="source-text" dangerouslySetInnerHTML={{ __html: html || " " }} /></span>)}</code></pre>}
    </Source>
  )
}

export default MarkdownSource
const Source = styled.section`
  min-width: 0;
  font-family: var(--font-mono, monospace);
  .source-caption { position: sticky; top: 0; z-index: 1; display: flex; gap: 12px; flex-wrap: wrap; padding: 8px 16px; background: ${({ theme }) => theme.colors.editor.bg2}; border-bottom: 1px solid ${({ theme }) => theme.colors.editor.line}; font-size: 11px; }
  .source-caption span { color: ${({ theme }) => theme.colors.editor.fg3}; }
  .source-state { padding: 20px; font-size: 13px; line-height: 1.7; }
  button, a { color: ${({ theme }) => theme.colors.editor.accent}; }
  button { padding: 4px 8px; border: 1px solid ${({ theme }) => theme.colors.editor.line}; cursor: pointer; background: none; }
  pre { margin: 0; padding: 16px 0; overflow: auto; background: ${({ theme }) => theme.colors.editor.bg}; color: ${({ theme }) => theme.colors.editor.fg}; font-size: 12px; line-height: 1.8; tab-size: 2; }
  code { display: block; min-width: max-content; font: inherit; text-shadow: none; }
  .source-line { display: flex; min-height: 1.8em; }
  .source-number { width: 54px; padding-right: 14px; flex-shrink: 0; color: ${({ theme }) => theme.colors.editor.fg3}; text-align: right; user-select: none; }
  .source-text { display: block; padding-right: 24px; white-space: pre; }
  pre:focus-visible, button:focus-visible { outline: 2px solid ${({ theme }) => theme.colors.editor.accent}; outline-offset: -2px; }
`
