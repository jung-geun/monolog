import { useQuery, skipToken } from "@tanstack/react-query"
import { useEffect, useRef } from "react"
import { queryKey } from "src/constants/queryKey"

const useMermaidEffect = () => {
  const memoMermaidRef = useRef<Map<number, string>>(new Map())

  const { data, isFetched } = useQuery({
    queryKey: queryKey.scheme(),
    queryFn: skipToken,
    enabled: false,
  })

  useEffect(() => {
    if (!isFetched) return

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
        theme: (data as "dark" | "light") === "dark" ? "dark" : "default",
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
  }, [data, isFetched])
}

export default useMermaidEffect
