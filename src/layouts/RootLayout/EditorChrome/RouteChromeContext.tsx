import React, { createContext, useCallback, useContext, useEffect, useState, ReactNode } from "react"

export type ChromeConfig = {
  filename: string
  statusItems: string[]
}

type RouteChromeContextValue = {
  chrome: ChromeConfig
  setChrome: (config: ChromeConfig) => void
  isFileTreeOpen: boolean
  setFileTreeOpen: (open: boolean) => void
  toggleFileTree: () => void
}

const defaultChrome: ChromeConfig = {
  filename: "README.md",
  statusItems: ["main", "✓ synced", "UTF-8", "Markdown"],
}

const RouteChromeContext = createContext<RouteChromeContextValue>({
  chrome: defaultChrome,
  setChrome: () => {},
  isFileTreeOpen: true,
  setFileTreeOpen: () => {},
  toggleFileTree: () => {},
})

export const useRouteChrome = () => useContext(RouteChromeContext)

export const RouteChromeProvider = ({ children }: { children: ReactNode }) => {
  const [chrome, setChrome] = useState<ChromeConfig>(defaultChrome)
  const [isFileTreeOpen, setFileTreeOpen] = useState(true)

  useEffect(() => {
    if (typeof window === "undefined") return
    if (window.matchMedia("(max-width: 960px)").matches) {
      setFileTreeOpen(false)
    }
  }, [])

  const toggleFileTree = useCallback(() => setFileTreeOpen((v) => !v), [])

  return (
    <RouteChromeContext.Provider
      value={{ chrome, setChrome, isFileTreeOpen, setFileTreeOpen, toggleFileTree }}
    >
      {children}
    </RouteChromeContext.Provider>
  )
}

// Call this in route components to register filename + statusItems.
// Pass a memoized statusItems array (useMemo) to avoid extra renders.
export const useRegisterChrome = (filename: string, statusItems: string[]) => {
  const { setChrome } = useRouteChrome()
  const key = filename + "|" + statusItems.join("\0")
  useEffect(() => {
    setChrome({ filename, statusItems })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, setChrome])
}
