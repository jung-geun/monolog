import { Global as _Global, css, useTheme } from "@emotion/react"

import { ThemeProvider as _ThemeProvider } from "@emotion/react"
import { pretendard } from "src/assets"

const LIGHT_VARS = `
  --c-ink: 28 29 26;
  --c-chrome: 239 233 217;
  --c-card: 235 225 199;
  --c-elevated: 215 202 168;
  --c-sunken: 250 247 238;
  --c-hairline: 189 180 153;
  --c-mute: 102 104 94;
  --c-soft: 122 124 114;
  --c-strong: 28 29 26;

  --c-signal: 194 65 12;
  --c-signal-50: 245 218 185;
  --c-signal-200: 233 168 84;
  --c-signal-900: 124 60 22;

  --c-cs: 15 110 87;
  --c-cs-50: 206 232 219;
  --c-cs-200: 99 184 153;
  --c-cs-900: 8 67 53;

  --c-paper: 68 56 156;
  --c-paper-50: 220 217 248;
  --c-paper-200: 144 134 220;
  --c-paper-900: 53 39 124;

  --c-research: 168 78 39;
  --c-research-50: 235 213 198;
  --c-research-200: 211 130 90;
  --c-research-900: 124 56 28;

  --c-grass-1: 233 168 84;
  --c-grass-2: 211 130 90;
  --c-grass-3: 194 65 12;
  --c-grass-4: 124 60 22;
`

const LIGHT_PRISM = `
  /* Light-mode Prism overrides — paper palette.
     prism-tomorrow.css remains imported for dark mode; in light we override
     .token.* and the code-block surface. */
  .notion .notion-code,
  .notion-code {
    background-color: #efe9d9 !important;
    border: 1px solid #d6cfb9;
  }

  .notion code[class*="language-"],
  .notion pre[class*="language-"] {
    color: #1c1d1a;
    text-shadow: none;
  }

  .notion .token.comment,
  .notion .token.prolog,
  .notion .token.doctype,
  .notion .token.cdata {
    color: #7a7c72;
    font-style: italic;
  }

  .notion .token.punctuation { color: #4a4d44; }

  .notion .token.property,
  .notion .token.tag,
  .notion .token.boolean,
  .notion .token.number,
  .notion .token.constant,
  .notion .token.symbol,
  .notion .token.deleted { color: #c2410c; }

  .notion .token.selector,
  .notion .token.string,
  .notion .token.char,
  .notion .token.builtin,
  .notion .token.inserted,
  .notion .token.attr-value { color: #0f6e57; }

  .notion .token.keyword,
  .notion .token.atrule { color: #1e4d6e; }

  .notion .token.function,
  .notion .token.class-name { color: #6f3a8a; }

  .notion .token.variable,
  .notion .token.regex,
  .notion .token.important { color: #1c1d1a; }

  .notion .token.operator,
  .notion .token.entity,
  .notion .token.url { color: #4a4d44; }

  .notion .token.attr-name,
  .notion .token.namespace { color: #1e4d6e; }
`

const DARK_PRISM = `
  /* Dark-mode Prism overrides — improve readability of plain code blocks
     and tree-drawing characters that prism-tomorrow renders too dim. */
  .notion .notion-code,
  .notion-code {
    background-color: #16181f !important;
    border: 1px solid #262830;
  }

  .notion code[class*="language-"],
  .notion pre[class*="language-"],
  .notion .notion-code,
  .notion-code {
    color: #ececea;
    text-shadow: none;
  }

  .notion .token.comment,
  .notion .token.prolog,
  .notion .token.doctype,
  .notion .token.cdata {
    color: #8a8c80;
    font-style: italic;
  }

  .notion .token.punctuation { color: #c8cac4; }

  .notion .token.property,
  .notion .token.tag,
  .notion .token.boolean,
  .notion .token.number,
  .notion .token.constant,
  .notion .token.symbol,
  .notion .token.deleted { color: #ffb37a; }

  .notion .token.selector,
  .notion .token.string,
  .notion .token.char,
  .notion .token.builtin,
  .notion .token.inserted,
  .notion .token.attr-value { color: #a8e0aa; }

  .notion .token.keyword,
  .notion .token.atrule { color: #b6d7ff; }

  .notion .token.function,
  .notion .token.class-name { color: #e5b5ff; }

  .notion .token.variable,
  .notion .token.regex,
  .notion .token.important { color: #ececea; }

  .notion .token.operator,
  .notion .token.entity,
  .notion .token.url { color: #c8cac4; }

  .notion .token.attr-name,
  .notion .token.namespace { color: #b6d7ff; }
`

const DARK_VARS = `
  --c-ink: 15 17 21;
  --c-chrome: 22 25 31;
  --c-card: 26 29 36;
  --c-elevated: 34 38 46;
  --c-sunken: 10 12 16;
  --c-hairline: 42 46 54;
  --c-mute: 138 140 130;
  --c-soft: 178 180 168;
  --c-strong: 236 236 234;

  --c-signal: 217 119 6;
  --c-signal-50: 250 238 218;
  --c-signal-200: 250 199 117;
  --c-signal-900: 133 79 11;

  --c-cs: 29 158 117;
  --c-cs-50: 225 245 238;
  --c-cs-200: 99 184 153;
  --c-cs-900: 8 80 65;

  --c-paper: 83 74 183;
  --c-paper-50: 238 237 254;
  --c-paper-200: 144 134 220;
  --c-paper-900: 60 52 137;

  --c-research: 216 90 48;
  --c-research-50: 250 236 231;
  --c-research-200: 211 130 90;
  --c-research-900: 153 60 29;

  --c-grass-1: 133 79 11;
  --c-grass-2: 217 119 6;
  --c-grass-3: 250 199 117;
  --c-grass-4: 250 238 218;
`

export const Global = () => {
  const theme = useTheme()
  const e = theme.colors.editor
  const isLight = theme.scheme === "light"

  return (
    <_Global
      styles={css`
        :root {
          ${isLight ? LIGHT_VARS : DARK_VARS}
        }

        html, body {
          height: 100%;
          margin: 0;
          padding: 0;
        }

        body {
          color: ${e.fg};
          background-color: ${e.bg};
          font-family: var(--font-mono, "JetBrains Mono", "IBM Plex Mono", ui-monospace, monospace);
          -webkit-font-smoothing: antialiased;
        }

        * {
          color-scheme: ${theme.scheme};
          box-sizing: border-box;
        }

        h1, h2, h3, h4, h5, h6 {
          margin: 0;
          font-weight: inherit;
          font-style: inherit;
        }

        a {
          all: unset;
          cursor: pointer;
        }

        ul {
          padding: 0;
        }

        button {
          all: unset;
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

        ${isLight ? LIGHT_PRISM : DARK_PRISM}
      `}
    />
  )
}
