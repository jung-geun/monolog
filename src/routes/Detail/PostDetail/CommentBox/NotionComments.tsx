import { useState, useEffect, useRef } from "react"
import styled from "@emotion/styled"
import type { TComment } from "src/types/comment"

type Props = {
  slug: string
  postId: string
}

function formatDate(iso: string): string {
  const d = new Date(iso)
  const pad = (n: number) => String(n).padStart(2, "0")
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`
}

const NotionComments: React.FC<Props> = ({ slug, postId }) => {
  const [items, setItems] = useState<TComment[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [body, setBody] = useState("")
  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [optimisticId, setOptimisticId] = useState<string | null>(null)
  const hpRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    setLoading(true)
    setError(null)
    fetch(`/api/comments?slug=${encodeURIComponent(slug)}`)
      .then((r) => r.json())
      .then((data) => setItems(data.items ?? []))
      .catch(() => setError("댓글을 불러오지 못했습니다."))
      .finally(() => setLoading(false))
  }, [slug])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (body.trim().length < 2) return
    setSubmitting(true)
    setSubmitError(null)

    const optimistic: TComment = {
      id: `opt-${Date.now()}`,
      slug,
      postId,
      nickname: "익명",
      body: body.trim(),
      createdAt: new Date().toISOString(),
    }
    setOptimisticId(optimistic.id)
    setItems((prev) => [...prev, optimistic])
    setBody("")

    try {
      const res = await fetch("/api/comments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          slug,
          postId,
          body: body.trim(),
          hp: hpRef.current?.value ?? "",
        }),
      })
      const data = await res.json()
      if (!res.ok) {
        setSubmitError(data.error ?? "댓글 등록에 실패했습니다.")
        setItems((prev) => prev.filter((c) => c.id !== optimistic.id))
      } else {
        setItems((prev) =>
          prev.map((c) => (c.id === optimistic.id ? data.comment : c))
        )
      }
    } catch {
      setSubmitError("네트워크 오류가 발생했습니다.")
      setItems((prev) => prev.filter((c) => c.id !== optimistic.id))
    } finally {
      setSubmitting(false)
      setOptimisticId(null)
      fetch(`/api/comments?slug=${encodeURIComponent(slug)}`)
        .then((r) => r.json())
        .then((data) => setItems(data.items ?? []))
        .catch(() => {})
    }
  }

  return (
    <StyledWrapper>
      <div className="comments-header">
        <span className="label">{"// comments"}</span>
        {!loading && <span className="count">{items.length}</span>}
      </div>

      <div className="comment-list">
        {loading && (
          <>
            {[1, 2].map((i) => (
              <div key={i} className="skeleton" />
            ))}
          </>
        )}
        {!loading && error && <p className="err">{error}</p>}
        {!loading && !error && items.length === 0 && (
          <p className="empty">첫 번째 댓글을 남겨보세요.</p>
        )}
        {items.map((c) => (
          <div key={c.id} className={`comment-item${c.id === optimisticId ? " optimistic" : ""}`}>
            <div className="meta">
              <span className="nick">{c.nickname}</span>
              <span className="date">{formatDate(c.createdAt)}</span>
            </div>
            <p className="body">{c.body}</p>
          </div>
        ))}
      </div>

      <form className="comment-form" onSubmit={handleSubmit}>
        <div className="input-area">
          <textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            placeholder="댓글을 입력하세요 (최대 1000자)"
            maxLength={1000}
            rows={3}
            disabled={submitting}
          />
          <span className="char-count">{body.length}/1000</span>
        </div>
        {submitError && <p className="err">{submitError}</p>}
        <div className="form-footer">
          <span className="anon-label">익명으로 게시됩니다</span>
          <button type="submit" disabled={submitting || body.trim().length < 2}>
            {submitting ? "등록 중…" : "댓글 등록"}
          </button>
        </div>
        <p className="delete-notice">
          삭제 요청: <a href="mailto:pieroot@konkuk.ac.kr">pieroot@konkuk.ac.kr</a>
        </p>
        {/* honeypot — hidden from real users */}
        <input
          ref={hpRef}
          type="text"
          name="website"
          tabIndex={-1}
          autoComplete="off"
          style={{ display: "none" }}
        />
      </form>
    </StyledWrapper>
  )
}

export default NotionComments

const StyledWrapper = styled.div`
  margin-top: 48px;
  border-top: 1px solid ${({ theme }) => theme.colors.editor.line};
  padding-top: 32px;
  font-family: var(--font-mono, monospace);

  .comments-header {
    display: flex;
    align-items: center;
    gap: 8px;
    margin-bottom: 20px;

    .label {
      font-size: 13px;
      color: ${({ theme }) => theme.colors.editor.accent};
      font-weight: 500;
    }

    .count {
      font-size: 12px;
      color: ${({ theme }) => theme.colors.editor.fg3};
      background: ${({ theme }) => theme.colors.editor.bg2};
      padding: 1px 6px;
      border-radius: 10px;
    }
  }

  .comment-list {
    display: flex;
    flex-direction: column;
    gap: 12px;
    margin-bottom: 24px;
  }

  .skeleton {
    height: 52px;
    background: ${({ theme }) => theme.colors.editor.bg2};
    border-radius: 3px;
    animation: pulse 1.4s ease-in-out infinite;

    @keyframes pulse {
      0%, 100% { opacity: 0.5; }
      50% { opacity: 1; }
    }
  }

  .comment-item {
    border: 1px solid ${({ theme }) => theme.colors.editor.line};
    border-radius: 3px;
    padding: 12px 14px;
    background: ${({ theme }) => theme.colors.editor.bg};

    &.optimistic {
      opacity: 0.6;
    }

    .meta {
      display: flex;
      align-items: center;
      gap: 10px;
      margin-bottom: 6px;
    }

    .nick {
      font-size: 12px;
      color: ${({ theme }) => theme.colors.editor.accent};
      font-weight: 500;
    }

    .date {
      font-size: 11px;
      color: ${({ theme }) => theme.colors.editor.fg3};
    }

    .body {
      font-size: 13px;
      color: ${({ theme }) => theme.colors.editor.fg};
      line-height: 1.6;
      white-space: pre-wrap;
      word-break: break-word;
      margin: 0;
    }
  }

  .empty {
    font-size: 13px;
    color: ${({ theme }) => theme.colors.editor.fg3};
    margin: 0;
  }

  .err {
    font-size: 12px;
    color: #e05252;
    margin: 4px 0 0;
  }

  .comment-form {
    display: flex;
    flex-direction: column;
    gap: 8px;

    .input-area {
      position: relative;

      textarea {
        width: 100%;
        background: ${({ theme }) => theme.colors.editor.bg2};
        border: 1px solid ${({ theme }) => theme.colors.editor.line};
        border-radius: 3px;
        padding: 10px 12px;
        padding-bottom: 24px;
        font-family: var(--font-mono, monospace);
        font-size: 13px;
        color: ${({ theme }) => theme.colors.editor.fg};
        resize: vertical;
        outline: none;
        box-sizing: border-box;

        &::placeholder {
          color: ${({ theme }) => theme.colors.editor.fg4};
        }

        &:focus {
          border-color: ${({ theme }) => theme.colors.editor.accent};
        }

        &:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }
      }

      .char-count {
        position: absolute;
        bottom: 6px;
        right: 10px;
        font-size: 10px;
        color: ${({ theme }) => theme.colors.editor.fg4};
        pointer-events: none;
      }
    }

    .form-footer {
      display: flex;
      align-items: center;
      justify-content: space-between;

      .anon-label {
        font-size: 11px;
        color: ${({ theme }) => theme.colors.editor.fg3};
      }

      button {
        background: ${({ theme }) => theme.colors.editor.accent};
        color: #fff;
        border: none;
        border-radius: 3px;
        padding: 6px 14px;
        font-family: var(--font-mono, monospace);
        font-size: 12px;
        cursor: pointer;
        transition: opacity 0.15s;

        &:hover:not(:disabled) {
          opacity: 0.85;
        }

        &:disabled {
          opacity: 0.4;
          cursor: not-allowed;
        }
      }
    }

    .delete-notice {
      font-size: 11px;
      color: ${({ theme }) => theme.colors.editor.fg4};
      margin: 2px 0 0;

      a {
        color: ${({ theme }) => theme.colors.editor.fg3};
        text-decoration: underline;
      }
    }
  }
`
