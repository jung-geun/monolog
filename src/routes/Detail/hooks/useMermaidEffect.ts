import { useEffect, useRef } from "react"
import useColorTheme from "src/hooks/useColorTheme"

const useMermaidEffect = () => {
  const memoMermaidRef = useRef<Map<number, string>>(new Map())

  const { theme } = useColorTheme()

  useEffect(() => {
    let cancelled = false
    const startTime = Date.now()

    const tryRender = async () => {
      if (cancelled) return

      const elements = document.getElementsByClassName("language-mermaid")
      if (elements.length === 0) {
        if (Date.now() - startTime < 5000) {
          setTimeout(tryRender, 100)
        }
        return
      }

      const { default: mermaid } = await import("mermaid")
      mermaid.initialize({
        startOnLoad: true,
        theme: "base",
        themeVariables: {
          darkMode: theme.scheme === "dark",
          background: theme.editor.bg,
          primaryColor: theme.editor.bg3,
          primaryTextColor: theme.editor.fg,
          primaryBorderColor: theme.editor.line2,
          secondaryColor: theme.editor.bg2,
          secondaryTextColor: theme.editor.fg,
          tertiaryColor: theme.editor.accentSoft,
          tertiaryTextColor: theme.editor.fg2,
          lineColor: theme.editor.fg3,
          textColor: theme.editor.fg,
          clusterBkg: theme.editor.bg2,
          edgeLabelBackground: theme.editor.bg,
          fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", "Pretendard Variable", sans-serif',
        },
      })

      const promises = Array.from(elements)
        .filter((el) => el.tagName === "PRE")
        .map(async (element, i) => {
          if (memoMermaidRef.current.get(i) !== undefined) {
            const svg = await mermaid
              .render("mermaid" + i, memoMermaidRef.current.get(i) || "")
              .then((res) => res.svg)
            element.animate(
              [
                { easing: "ease-in", opacity: 0 },
                { easing: "ease-out", opacity: 1 },
              ],
              { duration: 300, fill: "both" }
            )
            element.innerHTML = svg
            return
          }
          const text = element.textContent ?? ""
          const svg = await mermaid
            .render("mermaid" + i, text)
            .then((res) => res.svg)
          memoMermaidRef.current.set(i, text)
          element.innerHTML = svg
        })

      await Promise.all(promises)
    }

    tryRender().catch((error) => console.warn(error))

    return () => {
      cancelled = true
    }
  }, [theme])
}

export default useMermaidEffect
