import { useState, useEffect, useCallback } from "react"

const useCommandPalette = () => {
  const [open, setOpen] = useState(false)
  const [initialQuery, setInitialQuery] = useState("")

  const openPalette = useCallback((query = "") => {
    setInitialQuery(query)
    setOpen(true)
  }, [])
  const closePalette = useCallback(() => setOpen(false), [])

  useEffect(() => {
    const handler = (event: Event) => openPalette((event as CustomEvent<{ query?: string }>).detail?.query ?? "")
    window.addEventListener("open-command-palette", handler)
    return () => window.removeEventListener("open-command-palette", handler)
  }, [openPalette])

  useEffect(() => {
    if (!open) return
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false)
    }
    window.addEventListener("keydown", handler)
    return () => window.removeEventListener("keydown", handler)
  }, [open])

  return { open, initialQuery, closePalette }
}

export default useCommandPalette
