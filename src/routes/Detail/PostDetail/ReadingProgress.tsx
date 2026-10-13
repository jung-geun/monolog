import { useEffect, useState } from "react"
import styled from "@emotion/styled"
import { useWorkbench } from "src/layouts/RootLayout/EditorChrome/WorkbenchContext"
import { getReadingScrollRoot } from "./scrollRoot"

const ReadingProgress = () => {
  const [progress, setProgress] = useState(0)
  const { documentMode, documentContext } = useWorkbench()
  useEffect(() => {
    let root = getReadingScrollRoot()
    let frame = 0
    const update = () => {
      cancelAnimationFrame(frame)
      frame = requestAnimationFrame(() => {
        const element = root instanceof HTMLElement ? root : document.documentElement
        const maximum = element.scrollHeight - (root instanceof HTMLElement ? root.clientHeight : window.innerHeight)
        const position = root instanceof HTMLElement ? root.scrollTop : window.scrollY
        setProgress(maximum > 0 ? Math.min(100, Math.max(0, position / maximum * 100)) : 0)
      })
    }
    const resize = () => {
      root.removeEventListener("scroll", update)
      root = getReadingScrollRoot()
      root.addEventListener("scroll", update, { passive: true })
      update()
    }
    root.addEventListener("scroll", update, { passive: true })
    window.addEventListener("resize", resize)
    const observer = new ResizeObserver(update)
    const article = document.querySelector(".document-preview .body")
    if (article) observer.observe(article)
    update()
    return () => { cancelAnimationFrame(frame); observer.disconnect(); root.removeEventListener("scroll", update); window.removeEventListener("resize", resize) }
  }, [documentMode, documentContext?.slug])
  return <Progress aria-hidden="true"><div className="bar" style={{ transform: `scaleX(${progress / 100})` }} /></Progress>
}

export default ReadingProgress
const Progress = styled.div`
  height: 2px;
  background: ${({ theme }) => theme.colors.editor.line};
  position: sticky;
  top: 0;
  z-index: 14;
  .bar { height: 100%; width: 100%; background: ${({ theme }) => theme.colors.editor.accent}; transform-origin: left; transition: transform 0.1s linear; }
  @media (prefers-reduced-motion: reduce) { .bar { transition: none; } }
`
