import styled from "@emotion/styled"
import { useEffect, useRef, useState } from "react"
import { FiCheck, FiChevronDown, FiCopy, FiExternalLink, FiLoader } from "react-icons/fi"
import { markdownUrl } from "src/libs/seo"

type Props = { slug: string }

// Match the code-block fallback: report failure, remove the temporary field,
// and restore focus without scrolling. Keep Code's own copy flow untouched.
const copyLegacy = (content: string) => {
  if (typeof document.execCommand !== "function") throw new Error("Clipboard unavailable")
  const focused = document.activeElement
  const field = document.createElement("textarea")
  field.value = content
  field.readOnly = true
  field.tabIndex = -1
  field.setAttribute("aria-hidden", "true")
  field.style.cssText = "position:fixed;top:0;left:0;opacity:0"
  document.body.appendChild(field)
  try {
    field.select()
    if (!document.execCommand("copy")) throw new Error("Clipboard write failed")
  } finally {
    field.remove()
    if (focused instanceof HTMLElement) focused.focus({ preventScroll: true })
  }
}

// A slug change disposes the previous document's pending request and feedback.
const MarkdownActions = ({ slug }: Props) => <DocumentActions key={slug} slug={slug} />

const DocumentActions = ({ slug }: Props) => {
  const details = useRef<HTMLDetailsElement>(null)
  const request = useRef<AbortController | null>(null)
  const [state, setState] = useState<"idle" | "loading" | "success" | "error">("idle")
  const [message, setMessage] = useState("")
  const href = markdownUrl(slug)

  useEffect(() => {
    const closeOutside = (event: PointerEvent) => {
      if (event.target instanceof Node && !details.current?.contains(event.target) && details.current) {
        details.current.open = false
      }
    }
    const escape = (event: KeyboardEvent) => {
      if (event.key === "Escape" && details.current?.open) {
        details.current.open = false
        details.current.querySelector("summary")?.focus()
      }
    }
    document.addEventListener("pointerdown", closeOutside)
    document.addEventListener("keydown", escape)
    return () => {
      request.current?.abort()
      document.removeEventListener("pointerdown", closeOutside)
      document.removeEventListener("keydown", escape)
    }
  }, [])

  useEffect(() => {
    if (state !== "success" && state !== "error") return
    const timer = window.setTimeout(() => setMessage(""), 2500)
    return () => window.clearTimeout(timer)
  }, [state])

  const copy = async () => {
    if (request.current) return
    const controller = new AbortController()
    request.current = controller
    setState("loading")
    setMessage("Markdown을 불러오는 중입니다.")
    let content: string
    try {
      // Use the endpoint path on this origin, not the configured canonical host.
      const response = await fetch(new URL(href).pathname, {
        signal: controller.signal,
        mode: "same-origin",
      })
      if (!response.ok) throw new Error("Markdown request failed")
      content = await response.text()
    } catch {
      if (controller.signal.aborted) return
      request.current = null
      setState("error")
      setMessage("Markdown을 불러오지 못했습니다. 다시 시도해주세요.")
      return
    }
    if (controller.signal.aborted) return

    try {
      try {
        await navigator.clipboard.writeText(content)
      } catch {
        if (controller.signal.aborted) return
        copyLegacy(content)
      }
      if (controller.signal.aborted) return
      setState("success")
      setMessage("Markdown이 복사되었습니다.")
    } catch {
      if (controller.signal.aborted) return
      setState("error")
      setMessage("복사하지 못했습니다. 클립보드 권한을 확인해주세요.")
    } finally {
      request.current = null
    }
  }

  return (
    <Controls>
      <div className="split-button">
        <button
          type="button"
          className="copy-button"
          aria-label="Markdown 복사"
          title="Markdown 복사"
          aria-disabled={state === "loading"}
          aria-busy={state === "loading"}
          onClick={copy}
        >
          {state === "loading" ? <FiLoader aria-hidden="true" />
            : state === "success" ? <FiCheck aria-hidden="true" /> : <FiCopy aria-hidden="true" />}
        </button>
        <details
          ref={details}
          onBlur={event => {
            if (event.relatedTarget instanceof Node && !event.currentTarget.contains(event.relatedTarget)) {
              event.currentTarget.open = false
            }
          }}
        >
          <summary aria-label="Markdown 추가 작업" title="Markdown 추가 작업">
            <FiChevronDown aria-hidden="true" />
          </summary>
          <div className="disclosure">
            <a
              href={href}
              target="_blank"
              rel="noopener noreferrer"
              aria-label="Markdown으로 보기 (새 창)"
              onClick={() => { if (details.current) details.current.open = false }}
            >
              Markdown으로 보기
              <FiExternalLink aria-hidden="true" />
            </a>
          </div>
        </details>
      </div>
      <div role="status" aria-live="polite" aria-atomic="true" className={message ? "feedback" : "empty-status"}>
        {message}
      </div>
    </Controls>
  )
}

export default MarkdownActions

const Controls = styled.div`
  position: relative;
  pointer-events: auto;
  color: ${({ theme }) => theme.colors.editor.fg};
  font-size: 13px;

  .split-button {
    display: flex;
    border: 1px solid ${({ theme }) => theme.colors.editor.line};
    border-radius: 6px;
    background: ${({ theme }) => theme.colors.editor.bg2};
  }

  button, summary {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 40px;
    height: 36px;
    padding: 0;
    color: inherit;
    background: transparent;
    border: 0;
    cursor: pointer;
    list-style: none;

    &:hover { color: ${({ theme }) => theme.colors.editor.accent}; }
    &:focus-visible { outline: 2px solid ${({ theme }) => theme.colors.editor.accent}; outline-offset: 2px; }
  }

  .copy-button { border-radius: 5px 0 0 5px; }
  button[aria-disabled="true"] { cursor: progress; }
  summary { border-left: 1px solid ${({ theme }) => theme.colors.editor.line}; border-radius: 0 5px 5px 0; }
  summary::-webkit-details-marker { display: none; }
  svg { width: 16px; height: 16px; flex-shrink: 0; }

  .disclosure, .feedback {
    position: absolute;
    right: 0;
    top: calc(100% + 6px);
    max-width: calc(100vw - 40px);
    border: 1px solid ${({ theme }) => theme.colors.editor.line};
    border-radius: 6px;
    background: ${({ theme }) => theme.colors.editor.bg2};
    box-shadow: 0 4px 12px rgb(0 0 0 / 12%);
  }

  .disclosure {
    z-index: 1;
    width: 210px;
    padding: 4px;

    a {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 8px;
      padding: 10px;
      color: inherit;
      text-decoration: none;
      border-radius: 3px;
      &:hover { color: ${({ theme }) => theme.colors.editor.accent}; }
      &:focus-visible { outline: 2px solid ${({ theme }) => theme.colors.editor.accent}; outline-offset: -2px; }
    }
  }

  .feedback {
    width: 260px;
    padding: 10px 12px;
    line-height: 1.5;
    overflow-wrap: anywhere;
    pointer-events: none;
  }
  .empty-status { position: absolute; }
  &:has(details[open]) .feedback { top: calc(100% + 62px); }
`
