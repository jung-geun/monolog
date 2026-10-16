import { useEffect, useState } from "react"
import styled from "@emotion/styled"
import { useWorkbench } from "src/layouts/RootLayout/EditorChrome/WorkbenchContext"
import { getReadingScrollRoot, observeReadingScroll } from "./scrollRoot"

const ReadingProgress = () => {
  const [progress, setProgress] = useState(0)
  const { documentMode, documentContext } = useWorkbench()
  useEffect(() => observeReadingScroll(() => {
    const root = getReadingScrollRoot()
    const element = root instanceof HTMLElement ? root : document.documentElement
    const maximum = element.scrollHeight - (root instanceof HTMLElement ? root.clientHeight : window.innerHeight)
    const position = root instanceof HTMLElement ? root.scrollTop : window.scrollY
    setProgress(maximum > 0 ? Math.min(100, Math.max(0, position / maximum * 100)) : 0)
  }), [documentMode, documentContext?.slug])
  return <Progress aria-hidden="true"><div className="bar" style={{ transform: `scaleX(${progress / 100})` }} /></Progress>
}

export default ReadingProgress
const Progress = styled.div`
  height: 2px;
  background: ${({ theme }) => theme.colors.editor.line};
  position: relative;
  z-index: 14;
  .bar { height: 100%; width: 100%; background: ${({ theme }) => theme.colors.editor.accent}; transform-origin: left; transition: transform 0.1s linear; }
  @media (prefers-reduced-motion: reduce) { .bar { transition: none; } }
`
