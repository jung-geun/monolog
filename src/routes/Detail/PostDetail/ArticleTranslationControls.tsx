import styled from "@emotion/styled"
import { useId } from "react"

type Props = {
  sourceLanguage: string
  targetLanguage: string
  onSourceChange: (language: string) => void
  onTargetChange: (language: string) => void
  onTranslate: () => void
  onCancel: () => void
  onRestore: () => void
  busy: boolean
  hasTranslation: boolean
  canTranslate: boolean
  sourceError: string
  targetError: string
  availabilityMessage: string
  status: string
  error: string
  completed: number
  total: number
  downloadProgress: number | null
}

const ArticleTranslationControls = (props: Props) => {
  const id = useId()
  return <Controls aria-label="Article translation">
    <details>
      <summary>Translate</summary>
      <div className="translation-panel">
        <p id={`${id}-description`}>Translate this preview on your device using your browser’s built-in Translator API. Your browser may download a language model after you choose Translate article. No article text is sent to a cloud translation service.</p>
        <div className="translation-languages">
          <label htmlFor={`${id}-source`}>Source language
            <input id={`${id}-source`} value={props.sourceLanguage} onChange={event => props.onSourceChange(event.target.value)} placeholder="ko-KR" autoCapitalize="none" autoComplete="off" spellCheck={false} aria-invalid={Boolean(props.sourceError)} aria-describedby={props.sourceError ? `${id}-source-error` : `${id}-language-help`} />
            {props.sourceError && <span id={`${id}-source-error`}>{props.sourceError}</span>}
          </label>
          <label htmlFor={`${id}-target`}>Target language
            <input id={`${id}-target`} value={props.targetLanguage} onChange={event => props.onTargetChange(event.target.value)} placeholder="en" autoCapitalize="none" autoComplete="off" spellCheck={false} aria-invalid={Boolean(props.targetError)} aria-describedby={props.targetError ? `${id}-target-error` : `${id}-language-help`} />
            {props.targetError && <span id={`${id}-target-error`}>{props.targetError}</span>}
          </label>
        </div>
        <p id={`${id}-language-help`}>Enter BCP 47 language tags, for example ko, en, or zh-Hant. Changing either language cancels translation and restores the original.</p>
        <p>{props.availabilityMessage}</p>
        <p>Source stays original. Only the article preview changes, one sentence at a time; the source pane and exported Markdown are unchanged. Translations may be inaccurate.</p>
        <div className="translation-actions">
          <button type="button" disabled={!props.canTranslate || props.busy} onClick={props.onTranslate} aria-describedby={`${id}-description`}>Translate article</button>
          {props.busy && <button type="button" onClick={props.onCancel}>Cancel translation</button>}
          {props.hasTranslation && <button type="button" onClick={props.onRestore}>Restore original</button>}
        </div>
      </div>
    </details>
    <div className="translation-feedback" aria-busy={props.busy}>
      <span role="status" aria-live="polite" aria-atomic="true">{props.status}</span>
      {props.busy && (props.total > 0 && props.downloadProgress === null
        ? <progress max={props.total} value={props.completed} aria-label="Article sentences translated" />
        : <progress max={1} value={props.downloadProgress ?? undefined} aria-label="Preparing translation model" />)}
      <span role="alert">{props.error}</span>
    </div>
  </Controls>
}

export default ArticleTranslationControls

const Controls = styled.section`
  min-width: 0;
  padding: 6px 16px;
  border-bottom: 1px solid ${({ theme }) => theme.colors.editor.line};
  background: ${({ theme }) => theme.colors.editor.bg};
  color: ${({ theme }) => theme.colors.editor.fg2};
  font-size: 12px;
  line-height: 1.6;

  summary { width: fit-content; padding: 4px 0; color: ${({ theme }) => theme.colors.editor.fg}; cursor: pointer; }
  .translation-panel { max-width: 760px; padding: 6px 0 12px; }
  p { margin: 0 0 10px; overflow-wrap: anywhere; }
  .translation-languages { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 12px; margin-bottom: 8px; }
  label { display: flex; min-width: 0; flex-direction: column; gap: 4px; color: ${({ theme }) => theme.colors.editor.fg}; }
  input { box-sizing: border-box; width: 100%; min-width: 0; padding: 7px 9px; border: 1px solid ${({ theme }) => theme.colors.editor.line}; border-radius: 3px; background: ${({ theme }) => theme.colors.editor.bg2}; color: ${({ theme }) => theme.colors.editor.fg}; font: inherit; }
  label span { color: ${({ theme }) => theme.colors.editor.fg2}; }
  .translation-actions { display: flex; flex-wrap: wrap; gap: 8px; }
  button { min-height: 36px; padding: 6px 10px; border: 1px solid ${({ theme }) => theme.colors.editor.line}; border-radius: 3px; background: ${({ theme }) => theme.colors.editor.bg2}; color: ${({ theme }) => theme.colors.editor.fg}; font: inherit; cursor: pointer; }
  button:hover:not(:disabled) { color: ${({ theme }) => theme.colors.editor.accent}; }
  button:disabled { opacity: 0.55; cursor: not-allowed; }
  input:focus-visible, button:focus-visible, summary:focus-visible { outline: 2px solid ${({ theme }) => theme.colors.editor.accent}; outline-offset: 2px; }
  .translation-feedback { display: flex; flex-wrap: wrap; align-items: center; gap: 4px 12px; overflow-wrap: anywhere; }
  .translation-feedback:has(> span:empty):not(:has(progress)):not(:has(> span:not(:empty))) { display: none; }
  [role="alert"]:not(:empty) { flex-basis: 100%; color: ${({ theme }) => theme.colors.editor.fg}; }
  progress { width: min(180px, 100%); height: 8px; accent-color: ${({ theme }) => theme.colors.editor.accent}; }
  @media (max-width: 480px) {
    padding: 6px 12px;
    .translation-languages { grid-template-columns: minmax(0, 1fr); }
    .translation-actions button { flex: 1 1 auto; }
  }
`
