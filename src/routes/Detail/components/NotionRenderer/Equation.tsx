import { useMemo } from "react"
import type { Block } from "notion-types"
import { getBlockTitle } from "notion-utils"
import { useNotionContext } from "react-notion-x"
import katex from "katex"

type Props = {
  block: Block
  math?: string
  inline?: boolean
  className?: string
}

// RNX's Equation uses react-katex, which fills an empty div in an effect.
// Render the same KaTeX HTML/MathML before SSR and hydration instead.
export function Equation({ block, math, inline = false, className }: Props) {
  const { recordMap } = useNotionContext()
  const expression = math || getBlockTitle(block, recordMap)
  const html = useMemo(() => expression ? katex.renderToString(expression, {
    displayMode: !inline,
    throwOnError: false,
    strict: false,
    output: "htmlAndMathml",
  }) : "", [expression, inline])
  if (!expression) return null
  return (
    <span
      className={["notion-equation", inline ? "notion-equation-inline" : "notion-equation-block", className].filter(Boolean).join(" ")}
      dangerouslySetInnerHTML={{ __html: html }}
    />
  )
}
