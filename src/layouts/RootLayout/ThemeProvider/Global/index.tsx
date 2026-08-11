import { Global as _Global, css, useTheme } from "@emotion/react"

import { ThemeProvider as _ThemeProvider } from "@emotion/react"
import { pretendard } from "src/assets"

const LIGHT_VARS = `
  --c-ink: 31 31 31;
  --c-chrome: 248 248 248;
  --c-card: 255 255 255;
  --c-elevated: 242 242 242;
  --c-sunken: 242 242 242;
  --c-hairline: 229 229 229;
  --c-mute: 110 118 129;
  --c-soft: 134 134 134;
  --c-strong: 31 31 31;

  --c-signal: 0 95 184;
  --c-signal-50: 220 238 255;
  --c-signal-200: 77 143 209;
  --c-signal-900: 0 79 158;

  --c-cs: 38 127 153;
  --c-cs-50: 226 241 244;
  --c-cs-200: 84 166 188;
  --c-cs-900: 27 89 112;

  --c-paper: 121 94 38;
  --c-paper-50: 247 241 223;
  --c-paper-200: 210 188 124;
  --c-paper-900: 92 69 23;

  --c-research: 175 0 219;
  --c-research-50: 245 230 251;
  --c-research-200: 207 121 235;
  --c-research-900: 125 0 159;

  --c-grass-1: 228 244 231;
  --c-grass-2: 154 216 165;
  --c-grass-3: 46 160 67;
  --c-grass-4: 28 122 50;

  /* Documented CSS custom properties for semantic text/Notion compatibility */
  --fg-color: #1f1f1f;
  --bg-color: #ffffff;
  --theme-colors-gray1: #f8f8f8;
  --theme-colors-gray2: #fafafa;
  --theme-colors-gray3: #f2f2f2;
  --theme-colors-gray4: #e5e5e5;
  --theme-colors-gray5: #cecece;
  --theme-colors-gray6: #cecece;
  --theme-colors-gray7: #868686;
  --theme-colors-gray8: #868686;
  --theme-colors-gray9: #6e7681;
  --theme-colors-gray10: #3b3b3b;
  --theme-colors-gray11: #3b3b3b;
  --theme-colors-gray12: #1f1f1f;
`

const LIGHT_PRISM = `
  /* Light-mode Prism overrides — VS Code Light+ syntax palette. */
  .notion .notion-code,
  .notion-code {
    background-color: #f2f2f2 !important;
    border: 1px solid #e5e5e5;
  }

  .notion code[class*="language-"],
  .notion pre[class*="language-"] {
    color: #1f1f1f;
    text-shadow: none;
  }

  .notion .token.comment,
  .notion .token.prolog,
  .notion .token.doctype,
  .notion .token.cdata {
    color: #008000;
    font-style: italic;
  }

  .notion .token.punctuation { color: #3b3b3b; }

  .notion .token.property,
  .notion .token.tag { color: #0451a5; }

  .notion .token.boolean,
  .notion .token.number,
  .notion .token.constant,
  .notion .token.symbol { color: #098658; }

  .notion .token.deleted { color: #a31515; }
  .notion .token.selector { color: #800000; }

  .notion .token.string,
  .notion .token.char,
  .notion .token.attr-value { color: #a31515; }

  .notion .token.builtin,
  .notion .token.inserted { color: #267f99; }

  .notion .token.keyword,
  .notion .token.atrule,
  .notion .token.important { color: #af00db; }

  .notion .token.function { color: #795e26; }
  .notion .token.class-name,
  .notion .token.attr-name,
  .notion .token.namespace { color: #267f99; }

  .notion .token.variable,
  .notion .token.regex { color: #001080; }

  .notion .token.operator,
  .notion .token.entity,
  .notion .token.url { color: #3b3b3b; }
`

const DARK_PRISM = `
  /* Dark-mode Prism overrides — VS Code Dark+ syntax palette. */
  .notion .notion-code,
  .notion-code {
    background-color: #202020 !important;
    border: 1px solid #2b2b2b;
  }

  .notion code[class*="language-"],
  .notion pre[class*="language-"],
  .notion .notion-code,
  .notion-code {
    color: #e1e1e1;
    text-shadow: none;
  }

  .notion .token.comment,
  .notion .token.prolog,
  .notion .token.doctype,
  .notion .token.cdata {
    color: #6a9955;
    font-style: italic;
  }

  .notion .token.punctuation { color: #cccccc; }

  .notion .token.property,
  .notion .token.tag { color: #569cd6; }

  .notion .token.boolean,
  .notion .token.number,
  .notion .token.constant,
  .notion .token.symbol,
  .notion .token.inserted { color: #b5cea8; }

  .notion .token.deleted { color: #f85149; }
  .notion .token.selector { color: #d7ba7d; }

  .notion .token.string,
  .notion .token.char,
  .notion .token.attr-value { color: #ce9178; }

  .notion .token.builtin,
  .notion .token.class-name,
  .notion .token.attr-name,
  .notion .token.namespace { color: #4ec9b0; }

  .notion .token.keyword,
  .notion .token.atrule,
  .notion .token.important { color: #c586c0; }

  .notion .token.function { color: #dcdcaa; }
  .notion .token.variable { color: #9cdcfe; }
  .notion .token.regex { color: #d16969; }

  .notion .token.operator,
  .notion .token.entity,
  .notion .token.url { color: #cccccc; }
`

const DARK_VARS = `
  --c-ink: 225 225 225;
  --c-chrome: 24 24 24;
  --c-card: 31 31 31;
  --c-elevated: 37 37 37;
  --c-sunken: 32 32 32;
  --c-hairline: 43 43 43;
  --c-mute: 157 157 157;
  --c-soft: 179 179 179;
  --c-strong: 225 225 225;

  --c-signal: 0 120 212;
  --c-signal-50: 6 54 92;
  --c-signal-200: 77 170 252;
  --c-signal-900: 215 235 255;

  --c-cs: 78 201 176;
  --c-cs-50: 23 61 57;
  --c-cs-200: 128 221 203;
  --c-cs-900: 185 240 228;

  --c-paper: 220 220 170;
  --c-paper-50: 59 53 23;
  --c-paper-200: 241 234 166;
  --c-paper-900: 255 248 197;

  --c-research: 197 134 192;
  --c-research-50: 61 36 60;
  --c-research-200: 233 184 228;
  --c-research-900: 246 223 244;

  --c-grass-1: 28 59 35;
  --c-grass-2: 46 160 67;
  --c-grass-3: 181 206 168;
  --c-grass-4: 216 244 214;

  /* Documented CSS custom properties for semantic text/Notion compatibility */
  --fg-color: #e1e1e1;
  --bg-color: #1f1f1f;
  --theme-colors-gray1: #181818;
  --theme-colors-gray2: #1c1c1c;
  --theme-colors-gray3: #202020;
  --theme-colors-gray4: #2b2b2b;
  --theme-colors-gray5: #3c3c3c;
  --theme-colors-gray6: #3c3c3c;
  --theme-colors-gray7: #9d9d9d;
  --theme-colors-gray8: #9d9d9d;
  --theme-colors-gray9: #9d9d9d;
  --theme-colors-gray10: #b3b3b3;
  --theme-colors-gray11: #cccccc;
  --theme-colors-gray12: #e1e1e1;
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
          font-family: var(--font-sans, ${pretendard.style.fontFamily}, system-ui, sans-serif);
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

        ${isLight ? LIGHT_PRISM : DARK_PRISM}
      `}
    />
  )
}
