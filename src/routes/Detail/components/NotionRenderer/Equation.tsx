import { useMemo } from "react"
import type { Block } from "notion-types"
import { getBlockTitle } from "notion-utils"
import { useNotionContext } from "react-notion-x"
import katex from "katex"
import { parseInlineMath } from "src/libs/utils/notion/inlineMath"

type Props = {
  block?: Block
  math?: string
  inline?: boolean
  className?: string
}

// RNX's Equation uses react-katex, which fills an empty div in an effect.
// Render the same KaTeX HTML/MathML before SSR and hydration instead.
export function Equation({ block, math, inline = false, className }: Props) {
  const { recordMap } = useNotionContext()
  const raw = math ? parseInlineMath(math) : undefined
  const delimited = raw?.length === 1 && raw[0].type === "math" ? raw[0] : undefined
  const expression = delimited ? delimited.math : math ?? (block ? getBlockTitle(block, recordMap) : "")
  const isInline = delimited ? !delimited.displayMode : inline
  const html = useMemo(() => expression ? katex.renderToString(expression, {
    displayMode: !isInline,
    throwOnError: false,
    strict: false,
    trust: false,
    output: "htmlAndMathml",
  }) : "", [expression, isInline])
  if (!expression) return null
  return (
    <span
      className={["notion-equation", isInline ? "notion-equation-inline" : "notion-equation-block", !isInline && block && `notion-block-${block.id.replace(/-/g, "").toLowerCase()}`, className].filter(Boolean).join(" ")}
      dangerouslySetInnerHTML={{ __html: html }}
    />
  )
}
