import { Global as _Global, css, useTheme } from "@emotion/react"

import { pretendard } from "src/assets"

export const Global = () => {
  const theme = useTheme()
  const e = theme.colors.editor

  return (
    <_Global
      styles={css`

        html, body {
          min-height: 100%;
          margin: 0;
          padding: 0;
        }

        html {
          scroll-padding-top: ${theme.variables.titleBarHeight + theme.variables.tabBarHeight + 12}px;
        }

        body {
          color: ${e.fg};
          background-color: ${e.bg};
          font-family: var(--font-sans, ${pretendard.style.fontFamily}, system-ui, sans-serif);
          -webkit-font-smoothing: antialiased;
          /* Auto ads anchors are fixed overlays. Ignore Google's inline body spacer. */
          padding-bottom: 0 !important;
        }

        * {
          box-sizing: border-box;
        }

        h1, h2, h3, h4, h5, h6 {
          margin: 0;
          font-weight: inherit;
          font-style: inherit;
        }

        a {
          color: inherit;
          text-decoration: none;
        }

        ul {
          padding: 0;
        }

        button {
          background: none;
          border: none;
          padding: 0;
          font: inherit;
          color: inherit;
          cursor: pointer;
        }
        input {
          all: unset;
          box-sizing: border-box;
        }

        textarea {
          border: none;
          background-color: transparent;
          font-family: inherit;
          padding: 0;
          outline: none;
          resize: none;
          color: inherit;
        }

        hr {
          width: 100%;
          border: none;
          margin: 0;
          border-top: 1px solid ${e.line};
        }

        /* Pretendard for Korean prose inside Notion content */
        .notion-page p,
        .notion-page li,
        .notion-page blockquote {
          font-family: ${pretendard.style.fontFamily};
        }

        /* Accessible name fallback for empty Notion page links */
        .notion-page-link,
        .notion-page-title-text {
          position: relative;
        }
        .notion-page-link:empty::after,
        .notion-page-title-text:empty::before {
          content: "페이지";
          position: absolute;
          width: 1px;
          height: 1px;
          margin: -1px;
          padding: 0;
          overflow: hidden;
          clip: rect(0, 0, 0, 0);
          white-space: nowrap;
        }

        .notion, .notion.dark-mode {
          --fg-color: var(--editor-fg);
          --fg-color-0: rgb(var(--c-ink) / 0.09);
          --fg-color-1: rgb(var(--c-ink) / 0.16);
          --fg-color-2: rgb(var(--c-ink) / 0.4);
          --fg-color-3: var(--editor-fg3);
          --fg-color-4: var(--editor-fg2);
          --fg-color-5: rgb(var(--c-ink) / 0.024);
          --fg-color-6: var(--editor-fg2);
          --fg-color-7: var(--editor-fg3);
          --fg-color-icon: var(--editor-fg3);
          --bg-color: var(--editor-bg);
          --bg-color-0: var(--editor-bg3);
          --bg-color-1: var(--editor-bg2);
          --bg-color-2: var(--editor-bg3);
          --select-color-0: var(--editor-accent);
          --select-color-1: var(--editor-accentSoft);
          --select-color-2: var(--editor-accentSoft);
          color: var(--editor-fg);
          background: var(--editor-bg);
        }

        .notion .notion-code, .notion-code, .notion-code-frame,
        pre[class*="language-"], .document-source {
          background: var(--editor-gutter) !important;
          border-color: var(--editor-line);
          color: var(--editor-fg);
        }
        code, pre, kbd, samp {
          font-family: var(--font-mono, ui-monospace, monospace);
        }
        code[class*="language-"], pre[class*="language-"] {
          color: var(--editor-fg);
          text-shadow: none;
        }
        .notion .token.comment, .token.comment,
        .token.prolog, .token.doctype, .token.cdata {
          color: var(--syntax-comment);
          font-style: italic;
        }
        .notion .token.punctuation, .token.punctuation { color: var(--syntax-punctuation); }
        .notion .token.property, .token.property { color: var(--syntax-property); }
        .notion .token.tag, .token.tag { color: var(--syntax-tag); }
        .notion .token.boolean, .token.boolean { color: var(--syntax-boolean); }
        .notion .token.number, .token.number { color: var(--syntax-number); }
        .notion .token.constant, .token.constant, .token.symbol { color: var(--syntax-constant); }
        .notion .token.string, .token.string, .token.char, .token.attr-value { color: var(--syntax-string); }
        .notion .token.keyword, .token.keyword, .token.atrule, .token.important { color: var(--syntax-keyword); }
        .notion .token.function, .token.function { color: var(--syntax-function); }
        .notion .token.class-name, .token.class-name, .token.builtin, .token.namespace { color: var(--syntax-className); }
        .notion .token.attr-name, .token.attr-name { color: var(--syntax-attribute); }
        .notion .token.variable, .token.variable { color: var(--syntax-variable); }
        .notion .token.regex, .token.regex { color: var(--syntax-regex); }
        .notion .token.operator, .token.operator, .token.entity, .token.url {
          color: var(--syntax-operator);
          background: none;
        }
        .notion .token.deleted, .token.deleted { color: var(--syntax-deleted); }
        .notion .token.inserted, .token.inserted { color: var(--syntax-inserted); }
        .notion .token.selector, .token.selector { color: var(--syntax-selector); }
        .token.important, .token.bold { font-weight: 600; }
        .token.italic { font-style: italic; }
        .token.entity { cursor: help; }
        ::selection { background: var(--editor-accentSoft); color: var(--editor-fg2); }
        :focus-visible { outline: 1px solid var(--editor-accent); outline-offset: 2px; }
      `}
    />
  )
}
