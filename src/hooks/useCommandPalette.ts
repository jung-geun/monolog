import { useState, useEffect, useCallback } from "react"

const useCommandPalette = () => {
  const [open, setOpen] = useState(false)

  const openPalette = useCallback(() => setOpen(true), [])
  const closePalette = useCallback(() => setOpen(false), [])

  useEffect(() => {
    const handler = () => setOpen(true)
    window.addEventListener("open-command-palette", handler)
    return () => window.removeEventListener("open-command-palette", handler)
  }, [])

  useEffect(() => {
    if (!open) return
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false)
    }
    window.addEventListener("keydown", handler)
    return () => window.removeEventListener("keydown", handler)
  }, [open])

  return { open, openPalette, closePalette }
}

export default useCommandPalette
