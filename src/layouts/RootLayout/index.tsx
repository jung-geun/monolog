import React, { ReactNode, useEffect } from "react"
import { ThemeProvider } from "./ThemeProvider"
import useColorTheme from "src/hooks/useColorTheme"
import useGtagEffect from "./useGtagEffect"
import { useRouter } from "next/compat/router"
import EditorShell from "./EditorChrome/EditorShell"

type Props = {
  children: ReactNode
}

const RootLayout = ({ children }: Props) => {
  const { theme } = useColorTheme()
  const route = useRouter()?.asPath.split("#")[0]
  useGtagEffect()
  useEffect(() => {
    const content = document.querySelector(".page-content")
    if (!content) return
    const selector = '.notion-content code[class*="language-"]:not(.language-mermaid)'
    let cancelled = false
    const loadPrism = () => {
      if (!content.querySelector(selector)) return
      observer.disconnect()
      void import("./prism").then(({ default: Prism }) => {
        if (cancelled) return
        content.querySelectorAll<HTMLElement>(selector).forEach((code) => {
          Prism.highlightElement(code)
        })
      })
    }
    // Code blocks can arrive after hydration through the document renderer.
    const observer = new MutationObserver(loadPrism)
    observer.observe(content, { childList: true, subtree: true })
    loadPrism()
    return () => {
      cancelled = true
      observer.disconnect()
    }
  }, [route])

  return (
    <ThemeProvider colorTheme={theme}>
      <EditorShell>
        {children}
      </EditorShell>
    </ThemeProvider>
  )
}

export default RootLayout
