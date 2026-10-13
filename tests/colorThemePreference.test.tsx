import { act, useEffect } from "react"
import { createRoot, type Root } from "react-dom/client"
import useColorTheme, { type ColorThemeState } from "src/hooks/useColorTheme"
import { COLOR_THEME_STORAGE_KEY } from "src/styles/colors"

;(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true

let current: ColorThemeState
let container: HTMLDivElement
let root: Root
let systemDark = true
const mediaListeners = new Set<() => void>()
const originalMatchMedia = Object.getOwnPropertyDescriptor(window, "matchMedia")
const media = {
  get matches() { return systemDark },
  addEventListener: (_: string, listener: () => void) => { mediaListeners.add(listener) },
  removeEventListener: (_: string, listener: () => void) => { mediaListeners.delete(listener) },
}

function Consumer() {
  const value = useColorTheme()
  useEffect(() => { current = value }, [value])
  return <output>{value.preference}:{value.theme.id}</output>
}

beforeAll(() => {
  window.matchMedia = (() => media) as unknown as typeof window.matchMedia
})

afterAll(() => {
  if (originalMatchMedia) window.matchMedia = originalMatchMedia.value
})

beforeEach(() => {
  systemDark = true
  localStorage.clear()
  container = document.createElement("div")
  document.body.appendChild(container)
  root = createRoot(container)
  act(() => root.render(<Consumer />))
  act(() => current.setTheme("one-dark-pro-mix"))
})

afterEach(() => {
  act(() => root.unmount())
  container.remove()
  jest.restoreAllMocks()
  localStorage.clear()
})

it("persists a valid named visitor preference and updates all root theme attributes", () => {
  act(() => current.setTheme("light-modern"))
  expect(current.preference).toBe("light-modern")
  expect(current.theme.scheme).toBe("light")
  expect(localStorage.getItem(COLOR_THEME_STORAGE_KEY)).toBe("light-modern")
  expect(document.documentElement.dataset.colorTheme).toBe("light-modern")
  expect(document.documentElement.dataset.theme).toBe("light")
})

it("ignores invalid setters without replacing the existing valid preference", () => {
  act(() => current.setTheme("dark-modern"))
  act(() => current.setTheme("dark"))
  expect(current.theme.id).toBe("dark-modern")
  expect(localStorage.getItem(COLOR_THEME_STORAGE_KEY)).toBe("dark-modern")
})

it("changes the current visit even when persistence is unavailable", () => {
  jest.spyOn(Storage.prototype, "setItem").mockImplementation(() => { throw new Error("Storage unavailable") })
  act(() => current.setTheme("light-modern"))
  expect(current.preference).toBe("light-modern")
  expect(document.documentElement.dataset.theme).toBe("light")
})

it("keeps System live without overwriting the saved System selection", () => {
  act(() => current.setTheme("system"))
  expect(current.theme.id).toBe("dark-modern")
  act(() => { systemDark = false; mediaListeners.forEach((listener) => listener()) })
  expect(current.theme.id).toBe("light-modern")
  expect(current.preference).toBe("system")
  expect(localStorage.getItem(COLOR_THEME_STORAGE_KEY)).toBe("system")
})

it("does not change explicit named choices when the system scheme changes", () => {
  act(() => { systemDark = false; mediaListeners.forEach((listener) => listener()) })
  expect(current.theme.id).toBe("one-dark-pro-mix")
})

it("synchronizes valid preferences from another tab and falls back for invalid values", () => {
  act(() => window.dispatchEvent(new StorageEvent("storage", { key: COLOR_THEME_STORAGE_KEY, newValue: "light-modern" })))
  expect(current.theme.id).toBe("light-modern")
  act(() => window.dispatchEvent(new StorageEvent("storage", { key: COLOR_THEME_STORAGE_KEY, newValue: "invalid" })))
  expect(current.theme.id).toBe("one-dark-pro-mix")
})

it("retains the system listener when one of multiple consumers unmounts", () => {
  const extra = document.createElement("div")
  document.body.appendChild(extra)
  const extraRoot = createRoot(extra)
  act(() => extraRoot.render(<Consumer />))
  act(() => current.setTheme("system"))
  act(() => root.unmount())
  root = createRoot(container)
  act(() => { systemDark = false; mediaListeners.forEach((listener) => listener()) })
  expect(current.theme.id).toBe("light-modern")
  act(() => extraRoot.unmount())
  extra.remove()
})
