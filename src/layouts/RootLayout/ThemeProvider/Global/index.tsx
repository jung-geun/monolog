import { Global as _Global, css, useTheme } from "@emotion/react"

import { ThemeProvider as _ThemeProvider } from "@emotion/react"
import { pretendard } from "src/assets"

export const Global = () => {
  const theme = useTheme()
  const e = theme.colors.editor

  return (
    <_Global
      styles={css`
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

        /* Accessible name fallback for empty Notion page-link title spans */
        .notion-page-title-text {
          position: relative;
        }
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
      `}
    />
  )
}
