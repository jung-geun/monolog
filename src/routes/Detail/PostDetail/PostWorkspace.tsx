import styled from "@emotion/styled"

// The shell allocates our height; only the document panes, rail and panel scroll.
const PostWorkspace = styled.div`
  min-width: 0;
  min-height: 0;
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  > * { flex-shrink: 0; }
  .document-toolbar { position: relative; z-index: 12; display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 4px 12px; min-height: 40px; padding: 4px 12px; border-bottom: 1px solid ${({ theme }) => theme.colors.editor.line}; background: ${({ theme }) => theme.colors.editor.bg}; }
  .breadcrumbs { display: flex; gap: 6px; align-items: center; min-width: 0; flex: 1; font-size: 11px; color: ${({ theme }) => theme.colors.editor.fg3}; }
  .breadcrumbs a { color: inherit; text-decoration: none; white-space: nowrap; }
  .breadcrumbs span { text-overflow: ellipsis; overflow: hidden; white-space: nowrap; }
  .document-controls, .mode-switch { display: flex; align-items: center; gap: 2px; }
  .document-controls > button, .mode-switch button, .mobile-pane-switch button { display: inline-flex; align-items: center; gap: 5px; border: 0; background: transparent; color: ${({ theme }) => theme.colors.editor.fg3}; padding: 6px; font-size: 11px; cursor: pointer; }
  .document-controls button:hover, .document-controls button[aria-pressed="true"], .mobile-pane-switch button[aria-pressed="true"] { background: ${({ theme }) => theme.colors.editor.line}; color: ${({ theme }) => theme.colors.editor.fg}; }
  button:focus-visible, a:focus-visible, summary:focus-visible { outline: 2px solid ${({ theme }) => theme.colors.editor.accent}; outline-offset: 2px; }
  .document-controls .split-button { border: 0; border-radius: 0; background: none; }
  .document-controls .split-button button, .document-controls .split-button summary { width: 28px; height: 28px; border: 0; }
  .document-grid { flex: 1; min-height: 0; min-width: 0; display: grid; grid-template-columns: minmax(0, 1fr); grid-template-rows: minmax(0, 1fr); overflow: hidden; }
  .document-grid.with-rail { grid-template-columns: minmax(0, 1fr) 224px; }
  .document-main, .document-panes, .document-preview, .document-source { min-width: 0; min-height: 0; }
  .document-main { display: flex; flex-direction: column; overflow: hidden; }
  .document-panes { flex: 1; display: grid; grid-template-columns: minmax(0, 1fr); grid-template-rows: minmax(0, 1fr); overflow: hidden; }
  .document-preview, .document-source { overflow: auto; overscroll-behavior: contain; scrollbar-gutter: stable; }
  .document-preview[hidden] { display: none; }
  .document-panes--split { grid-template-columns: minmax(0, 1fr) minmax(0, 1fr); }
  .document-source { border-left: 1px solid ${({ theme }) => theme.colors.editor.line}; }
  /* The pane, not an unbounded nested pre, owns both source scroll axes. */
  .document-source pre { overflow: visible; min-width: 100%; width: max-content; }
  .split-selection-match { background-color: color-mix(in srgb, ${({ theme }) => theme.colors.editor.accent} 14%, transparent); box-shadow: inset 3px 0 ${({ theme }) => theme.colors.editor.accent}; }
  ::highlight(split-selection) { background-color: ${({ theme }) => theme.colors.editor.accent}; color: ${({ theme }) => theme.colors.editor.bg}; }
  .document-panes--source .document-source { border-left: 0; }
  .split-options { display: flex; align-items: center; flex-wrap: wrap; gap: 8px 18px; padding: 6px 16px; border-bottom: 1px solid ${({ theme }) => theme.colors.editor.line}; color: ${({ theme }) => theme.colors.editor.fg3}; font-size: 10px; }
  .split-options label { display: inline-flex; align-items: center; gap: 6px; }
  .split-options input[type="checkbox"] { appearance: auto; width: 13px; height: 13px; accent-color: ${({ theme }) => theme.colors.editor.accent}; }
  .mobile-pane-switch { display: none; }
  .body { box-sizing: border-box; min-width: 0; width: 100%; max-width: 880px; margin: 0 auto; padding: 30px clamp(16px, 3vw, 32px) 40px; overflow-wrap: anywhere; }
  .document-panes--split .body { padding: 24px 20px; }
  .preview-label { font-family: var(--font-mono, monospace); font-size: 10px; color: ${({ theme }) => theme.colors.editor.fg3}; margin-bottom: 12px; }
  .post-title { font-family: var(--font-sans, system-ui, sans-serif); font-size: clamp(26px, 3vw, 36px); font-weight: 650; margin: 0 0 14px; line-height: 1.3; letter-spacing: -0.035em; color: ${({ theme }) => theme.colors.editor.fg}; text-wrap: balance; }
  .post-summary { color: ${({ theme }) => theme.colors.editor.fg2}; line-height: 1.8; white-space: pre-wrap; font-size: 15px; margin: 0 0 24px; }
  .hero-thumb { position: relative; width: 100%; aspect-ratio: 21 / 9; max-height: 260px; overflow: hidden; margin-bottom: 28px; background: ${({ theme }) => theme.colors.editor.bg2}; }
  .notion-content { font-size: 16px; line-height: 1.85; }
  .notion-content .notion-page { padding: 0 !important; width: 100%; }
  .notion-content :is(h2, h3, h4, h5) { scroll-margin-top: 72px; }
  .notion-content code:not(pre code), .notion-content .notion-inline-code { background: ${({ theme }) => theme.colors.editor.bg2}; color: ${({ theme }) => theme.colors.editor.accent}; border-radius: 3px; padding: 2px 5px; font-family: var(--font-mono, monospace); }
  .about-sections { margin-bottom: 24px; }
  .about-sections > details { border-bottom: 1px solid ${({ theme }) => theme.colors.editor.line}; padding: 12px 0; }
  .about-sections > details > summary { cursor: pointer; margin-bottom: 12px; font-size: 13px; font-weight: 600; }
  .profile-bio { font-size: 14px; color: ${({ theme }) => theme.colors.editor.fg2}; margin-bottom: 20px; }
  .document-context-links { display: flex; flex-wrap: wrap; gap: 16px; margin: 28px 0; padding-top: 16px; border-top: 1px solid ${({ theme }) => theme.colors.editor.line}; }
  .document-context-links button { display: inline-flex; align-items: center; gap: 6px; background: none; border: 0; padding: 0; font-size: 12px; color: ${({ theme }) => theme.colors.editor.fg2}; cursor: pointer; }
  .document-context-links button:hover { color: ${({ theme }) => theme.colors.editor.accent}; }
  #document-bottom-panel { flex: 0 1 280px; min-height: 0; max-height: 38%; overflow: auto; overscroll-behavior: contain; background: ${({ theme }) => theme.colors.editor.bg2}; }
  #document-bottom-panel:has(> [hidden]), #document-bottom-panel:empty { display: none; }
  #document-bottom-panel .panel-tabs { position: sticky; top: 0; z-index: 1; flex-wrap: wrap; background: ${({ theme }) => theme.colors.editor.bg2}; }
  .panel-footer-label { color: ${({ theme }) => theme.colors.editor.fg3}; font-size: 10px; padding: 6px 24px; background: ${({ theme }) => theme.colors.editor.bg2}; }
  .source-loading { padding: 20px; font-size: 12px; color: ${({ theme }) => theme.colors.editor.fg3}; }
  &.reading-mode .body { max-width: 900px; padding-top: 40px; }
  @container editor (max-width: 1099px) {
    .mode-switch button span { display: none; }
    .document-grid.with-rail { grid-template-columns: minmax(0, 1fr); grid-template-rows: minmax(0, 1fr) minmax(0, 3fr); }
    .document-grid.with-rail .document-main { grid-row: 2; }
    .document-grid.with-rail .document-rail { grid-row: 1; border-left: 0; border-bottom: 1px solid ${({ theme }) => theme.colors.editor.line}; }
    .document-panes--split { grid-template-columns: minmax(0, 1fr); }
    .document-panes--split.mobile-pane--preview .document-source, .document-panes--split.mobile-pane--source .document-preview { display: none; }
    .mobile-pane-switch { display: flex; }
    .split-options > label, .split-options > span { display: none; }
    .document-source { border-left: 0; }
    #document-bottom-panel .references-grid { grid-template-columns: minmax(0, 1fr); gap: 20px; }
  }
  @container editor (max-width: 600px) {
    .document-toolbar { padding: 6px 10px; }
    .breadcrumbs { flex-basis: 100%; padding: 3px; }
    .document-controls { width: 100%; justify-content: flex-end; }
    .mode-switch { margin-right: auto; }
    .mode-switch button span { display: inline; }
    .document-grid.with-rail { grid-template-rows: minmax(0, min(96px, 25%)) minmax(0, 1fr); }
    .body, .document-panes--split .body { padding: 24px 16px 36px; }
    .post-title { font-size: 28px; }
    .notion-content { font-size: 15px; }
    &.reading-mode .body { padding: 28px 16px; }
  }
`

export default PostWorkspace
