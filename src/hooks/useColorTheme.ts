import { useSyncExternalStore } from "react"
import { CONFIG } from "site.config"
import {
  COLOR_THEME_STORAGE_KEY,
  colorThemes,
  getColorThemePreference,
  isColorThemePreference,
  resolveColorTheme,
  type ColorTheme,
  type ColorThemePreference,
} from "src/styles/colors"

const operatorPreference = getColorThemePreference(CONFIG.blog.theme)
type Snapshot = { preference: ColorThemePreference; theme: ColorTheme }
export interface ColorThemeState extends Snapshot {
  themes: readonly ColorTheme[]
  setTheme(id: string): void
}
const serverSnapshot: Snapshot = { preference: operatorPreference, theme: resolveColorTheme(operatorPreference) }
let snapshot = serverSnapshot
let initialized = false
let media: MediaQueryList | undefined
const listeners = new Set<() => void>()

function applyTheme(preference: ColorThemePreference) {
  const theme = resolveColorTheme(preference, media?.matches ?? true)
  const root = document.documentElement
  root.dataset.colorTheme = theme.id
  root.dataset.theme = theme.scheme
  root.dataset.themePreference = preference
  root.style.colorScheme = theme.scheme
  document.querySelector('meta[name="theme-color"]')?.setAttribute("content", theme.editor.bg2)
  if (snapshot.preference === preference && snapshot.theme.id === theme.id) return
  snapshot = { preference, theme }
  listeners.forEach((listener) => listener())
}

function handleSystemChange() {
  if (snapshot.preference === "system") applyTheme("system")
}

function handleStorageChange(event: StorageEvent) {
  if (event.key !== COLOR_THEME_STORAGE_KEY && event.key !== null) return
  applyTheme(isColorThemePreference(event.newValue) ? event.newValue : operatorPreference)
}

function subscribe(listener: () => void) {
  listeners.add(listener)
  if (!initialized) {
    initialized = true
    try { media = window.matchMedia("(prefers-color-scheme: dark)") } catch { /* No media API: deterministic dark default. */ }
    let preference = operatorPreference
    const bootstrapped = document.documentElement.dataset.themePreference
    if (isColorThemePreference(bootstrapped)) preference = bootstrapped
    try {
      const saved = window.localStorage.getItem(COLOR_THEME_STORAGE_KEY)
      if (isColorThemePreference(saved)) preference = saved
    } catch { /* The current visit works even when storage is denied. */ }
    applyTheme(preference)
  }
  applyTheme(snapshot.preference)
  if (listeners.size === 1) {
    media?.addEventListener("change", handleSystemChange)
    window.addEventListener("storage", handleStorageChange)
  }
  return () => {
    listeners.delete(listener)
    if (listeners.size === 0) {
      media?.removeEventListener("change", handleSystemChange)
      window.removeEventListener("storage", handleStorageChange)
    }
  }
}

function setTheme(id: string) {
  if (!isColorThemePreference(id) || typeof document === "undefined") return
  applyTheme(id)
  try { window.localStorage.setItem(COLOR_THEME_STORAGE_KEY, id) } catch { /* Keep the in-memory visitor selection. */ }
}

const getSnapshot = () => snapshot
const getServerSnapshot = () => serverSnapshot

export function useColorTheme(): ColorThemeState {
  const current = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot)
  return { ...current, themes: colorThemes, setTheme }
}

export default useColorTheme
