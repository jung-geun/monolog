import { useEffect, useRef, useState } from "react"
import styled from "@emotion/styled"

type Props = {
  count?: number
}

const FONT_SIZE = 12
const LINE_HEIGHT_RATIO = 1.7
const PAD_TOP = 30
const PAD_BOTTOM = 60
const LINE_PX = FONT_SIZE * LINE_HEIGHT_RATIO

const LineNumberGutter = ({ count: initial = 80 }: Props) => {
  const ref = useRef<HTMLDivElement>(null)
  const [count, setCount] = useState(initial)

  useEffect(() => {
    const el = ref.current
    if (!el) return

    const measure = () => {
      const inner = el.clientHeight - PAD_TOP - PAD_BOTTOM
      const next = Math.max(1, Math.ceil(inner / LINE_PX))
      setCount((prev) => (prev === next ? prev : next))
    }

    measure()
    const ro = new ResizeObserver(measure)
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  return (
    <StyledWrapper ref={ref} aria-hidden="true">
      <div className="lines">
        {Array.from({ length: count }, (_, i) => (
          <div key={i + 1} />
        ))}
      </div>
    </StyledWrapper>
  )
}

export default LineNumberGutter

const StyledWrapper = styled.div`
  position: relative;
  width: ${({ theme }) => theme.variables.gutterWidth}px;
  background: ${({ theme }) => theme.colors.editor.gutter};
  border-right: 1px solid ${({ theme }) => theme.colors.editor.line};
  color: ${({ theme }) => theme.colors.editor.fg4};
  font-size: 12px;
  font-family: var(--font-mono, monospace);
  line-height: 1.7;
  user-select: none;
  flex-shrink: 0;
  overflow: hidden;

  .lines {
    position: absolute;
    top: 30px;
    right: 10px;
    left: 10px;
    bottom: 60px;
    text-align: right;
    counter-reset: line;

    > div {
      counter-increment: line;
      &::before { content: counter(line); }
    }
  }

  @media (max-width: ${({ theme }) => theme.variables.breakpoint}px) {
    display: none;
  }
`
