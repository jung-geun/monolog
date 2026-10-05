import { useEffect, useState } from "react"
import styled from "@emotion/styled"

const ReadingProgress = () => {
  const [progress, setProgress] = useState(0)

  useEffect(() => {
    const update = () => {
      const max = document.documentElement.scrollHeight - window.innerHeight
      setProgress(max > 0 ? (window.scrollY / max) * 100 : 0)
    }

    update()
    window.addEventListener("scroll", update, { passive: true })
    window.addEventListener("resize", update)
    return () => {
      window.removeEventListener("scroll", update)
      window.removeEventListener("resize", update)
    }
  }, [])

  return (
    <StyledWrapper>
      <div className="bar" style={{ width: `${progress}%` }} />
    </StyledWrapper>
  )
}

export default ReadingProgress

const StyledWrapper = styled.div`
  height: 2px;
  background: ${({ theme }) => theme.colors.editor.line};
  position: sticky;
  top: ${({ theme }) => theme.variables.titleBarHeight + theme.variables.tabBarHeight}px;
  z-index: 30;
  flex-shrink: 0;

  .bar {
    height: 100%;
    background: ${({ theme }) => theme.colors.editor.accent};
    transition: width 0.1s linear;
    @media (prefers-reduced-motion: reduce) { transition: none; }
  }
`
