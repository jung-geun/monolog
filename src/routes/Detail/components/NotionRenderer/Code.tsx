import styled from "@emotion/styled"
import { useEffect, useMemo, useRef, useState } from "react"
import { createPortal } from "react-dom"
import type { CodeBlock } from "notion-types"
import { getBlockTitle } from "notion-utils"
import { Text, useNotionContext } from "react-notion-x"
import Prism from "prismjs"
import "prismjs/components/prism-css-extras.min.js"
import "prismjs/components/prism-js-extras.min.js"
import "prismjs/components/prism-json.min.js"
import "prismjs/components/prism-typescript.min.js"
import "prismjs/components/prism-jsx.min.js"
import "prismjs/components/prism-tsx.min.js"
import { FiCopy } from "react-icons/fi"
import { SafeBlock } from "./SafeBlock"

// Register the same additional grammars as RNX; the shared RootLayout registers
// the other Notion languages. Keep controls out of the scrollable source text.
type Props = { block: CodeBlock; defaultLanguage?: string; className?: string }

export const Code = (props: Props) => (
  <SafeBlock name="Code" fallback={<pre className="notion-code"><code>{props.block.properties.title?.map(segment => segment[0]).join("") ?? ""}</code></pre>}>
    <CodeContent {...props} />
  </SafeBlock>
)

const CodeContent = ({ block, defaultLanguage = "typescript", className }: Props) => {
  const { recordMap } = useNotionContext()
  const content = useMemo(() => getBlockTitle(block, recordMap), [block, recordMap])
  const notionLanguage = (block.properties.language?.[0]?.[0] || defaultLanguage).toLowerCase()
  const language = notionLanguage === "c++" ? "cpp" : notionLanguage === "f#" ? "fsharp" : notionLanguage
  const codeRef = useRef<HTMLElement>(null)
  const mounted = useRef(false)
  const timeout = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  const [copying, setCopying] = useState(false)
  const [message, setMessage] = useState("")

  useEffect(() => {
    mounted.current = true
    return () => {
      mounted.current = false
      clearTimeout(timeout.current)
    }
  }, [])

  useEffect(() => {
    if (codeRef.current && language !== "mermaid") {
      Prism.highlightElement(codeRef.current)
    }
  }, [content, language])

  const copy = async () => {
    setCopying(true)
    let result: string
    try {
      await navigator.clipboard.writeText(content)
      result = "복사되었습니다."
    } catch {
      result = "복사하지 못했습니다. 클립보드 권한을 확인해주세요."
    }
    if (!mounted.current) return
    setCopying(false)
    setMessage(result)
    clearTimeout(timeout.current)
    timeout.current = setTimeout(() => setMessage(""), 2500)
  }

  return (
    <>
      <Figure className="notion-code-figure">
        <Frame className="notion-code-frame">
          <div className="code-toolbar">
            <button type="button" aria-label="코드 복사" title="코드 복사" onClick={copy} disabled={copying}>
              <FiCopy aria-hidden="true" />
            </button>
          </div>
          <pre className={["notion-code", `language-${language}`, className].filter(Boolean).join(" ")} tabIndex={0} aria-label="코드 내용">
            <code className={`language-${language}`} ref={codeRef}>{content}</code>
          </pre>
        </Frame>
        {block.properties.caption && (
          <figcaption className="notion-asset-caption"><Text value={block.properties.caption} block={block} /></figcaption>
        )}
      </Figure>
      {message && createPortal(<Toast role="status" aria-live="polite">{message}</Toast>, document.body)}
    </>
  )
}

const Figure = styled.figure`
  width: 100%;
  min-width: 0;
  margin: 0.5em 0;
`

const Frame = styled.div`
  width: 100%;
  min-width: 0;
  margin: 0;
  border-radius: 6px;

  .code-toolbar {
    display: flex;
    justify-content: flex-end;
    padding: 8px 12px 0;
  }

  button {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 34px;
    height: 34px;
    border: 1px solid var(--color-hairline, rgb(var(--c-hairline)));
    border-radius: 6px;
    color: var(--color-ink, rgb(var(--c-ink)));
    background: var(--color-card, rgb(var(--c-card)));
    cursor: pointer;
  }
  button:hover { background: var(--color-sunken, rgb(var(--c-sunken))); }
  button:focus-visible { outline: 2px solid var(--color-signal, rgb(var(--c-signal))); outline-offset: 2px; }
  button:disabled { cursor: wait; opacity: 0.6; }

  pre.notion-code {
    margin: 0;
    padding: 12px 16px 16px;
    max-height: 30rem;
    overflow: auto;
    border: 0;
    border-radius: 0 0 6px 6px;
    background: transparent !important;
  }
  pre.notion-code > code {
    display: block;
    margin: 0;
    padding: 0;
    border: 0;
    border-radius: 0;
    background: transparent;
    color: inherit;
    white-space: pre;
    text-indent: 0;
  }
`

const Toast = styled.div`
  position: fixed;
  right: 20px;
  bottom: 36px;
  z-index: 1000;
  max-width: calc(100vw - 40px);
  padding: 10px 16px;
  border: 1px solid var(--color-hairline, rgb(var(--c-hairline)));
  border-radius: 8px;
  color: var(--color-ink, rgb(var(--c-ink)));
  background: var(--color-card, rgb(var(--c-card)));
  box-shadow: 0 4px 18px rgb(0 0 0 / 15%);
  font-size: 14px;
  line-height: 1.5;
`
