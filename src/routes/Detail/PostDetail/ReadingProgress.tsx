import { useEffect, useState } from "react"
import styled from "@emotion/styled"

const ReadingProgress = () => {
  const [progress, setProgress] = useState(0)

  useEffect(() => {
    const el = document.querySelector(".scroll-area")
    if (!el) return

    const update = () => {
      const scrollTop = el.scrollTop
      const scrollHeight = el.scrollHeight - el.clientHeight
      setProgress(scrollHeight > 0 ? (scrollTop / scrollHeight) * 100 : 0)
    }

    el.addEventListener("scroll", update, { passive: true })
    return () => el.removeEventListener("scroll", update)
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
  flex-shrink: 0;

  .bar {
    height: 100%;
    background: ${({ theme }) => theme.colors.editor.accent};
    transition: width 0.1s linear;
  }
`
