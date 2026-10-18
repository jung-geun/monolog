import { act, useEffect, useLayoutEffect } from "react"
import { createRoot, type Root } from "react-dom/client"
import { ThemeProvider } from "@emotion/react"
import CommandPalette from "src/components/CommandPalette"
import { WorkbenchProvider, useWorkbench, type WorkbenchState } from "src/layouts/RootLayout/EditorChrome/WorkbenchContext"
import SettingsPanel from "src/layouts/RootLayout/EditorChrome/SettingsPanel"
import useArticleTranslation from "src/routes/Detail/PostDetail/useArticleTranslation"
import { createTheme } from "src/styles/theme"
import { resolveColorTheme } from "src/styles/colors"

jest.mock("next/compat/router", () => ({ useRouter: () => null }))
jest.mock("src/hooks/usePostsQuery", () => ({ __esModule: true, default: () => [] }))
jest.mock("src/hooks/useCategoriesQuery", () => ({ useCategoriesQuery: () => ({}) }))
jest.mock("src/hooks/useTagsQuery", () => ({ useTagsQuery: () => ({}) }))
jest.mock("src/hooks/useColorTheme", () => ({ __esModule: true, default: () => ({ themes: [], preference: "system", theme: jest.requireActual("src/styles/colors").resolveColorTheme("one-dark-pro-mix"), setTheme: jest.fn() }) }))

;(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true

const article = { title: "첫 문장.", summary: "", recordMap: null }
const theme = createTheme({ colorTheme: resolveColorTheme("one-dark-pro-mix") })
let workbench: WorkbenchState
function Probe() {
  const value = useWorkbench()
  useEffect(() => { workbench = value }, [value])
  return null
}
function Article({ slug }: { slug: string }) {
  const translation = useArticleTranslation(article, slug)
  const { setDocumentContext, registerArticleTranslation } = useWorkbench()
  useEffect(() => {
    setDocumentContext({ slug, title: article.title, headings: [] })
    return () => setDocumentContext(null)
  }, [slug, setDocumentContext])
  useLayoutEffect(() => {
    if (!translation.supported) return
    return registerArticleTranslation(slug, translation.openLanguagePanel)
  }, [slug, translation.supported, translation.openLanguagePanel, registerArticleTranslation])
  return <div className="document-main"><div className="document-panes" />{translation.controls}</div>
}

let host: HTMLDivElement
let root: Root
let previousTranslator: PropertyDescriptor | undefined
let previousLanguage: PropertyDescriptor | undefined
let previousScrollIntoView: PropertyDescriptor | undefined
const create = jest.fn()
const render = async (slug: string | null = "first") => {
  await act(async () => {
    root.render(<ThemeProvider theme={theme}><WorkbenchProvider><Probe /><button type="button" id="palette-launcher">Commands</button>{slug && <Article slug={slug} />}<SettingsPanel /><CommandPalette /></WorkbenchProvider></ThemeProvider>)
  })
}
const openPalette = (query: string) => act(() => {
  window.dispatchEvent(new CustomEvent("open-command-palette", { detail: { query } }))
})
const translationOption = () => Array.from(host.querySelectorAll<HTMLElement>('[role="option"]')).find(option => option.textContent?.includes("Translate: Article language…"))
const executeTranslation = () => act(() => {
  const input = host.querySelector<HTMLInputElement>('[role="combobox"]')!
  input.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true }))
})

beforeEach(() => {
  previousTranslator = Object.getOwnPropertyDescriptor(globalThis, "Translator")
  previousLanguage = Object.getOwnPropertyDescriptor(navigator, "language")
  previousScrollIntoView = Object.getOwnPropertyDescriptor(HTMLElement.prototype, "scrollIntoView")
  Object.defineProperty(navigator, "language", { configurable: true, value: "en-US" })
  Object.defineProperty(HTMLElement.prototype, "scrollIntoView", { configurable: true, value: jest.fn() })
  create.mockReset()
  Object.defineProperty(globalThis, "Translator", { configurable: true, value: { availability: jest.fn().mockResolvedValue("available"), create } })
  host = document.createElement("div")
  document.body.appendChild(host)
  root = createRoot(host)
})
afterEach(() => {
  act(() => root.unmount())
  host.remove()
  if (previousTranslator) Object.defineProperty(globalThis, "Translator", previousTranslator)
  else Reflect.deleteProperty(globalThis, "Translator")
  if (previousLanguage) Object.defineProperty(navigator, "language", previousLanguage)
  else Reflect.deleteProperty(navigator, "language")
  if (previousScrollIntoView) Object.defineProperty(HTMLElement.prototype, "scrollIntoView", previousScrollIntoView)
  else Reflect.deleteProperty(HTMLElement.prototype, "scrollIntoView")
})

it.each([">번역", "translation"])("discovers the article language command with %s and focuses the existing panel after quick-pick teardown", async query => {
  await render()
  const launcher = host.querySelector<HTMLButtonElement>("#palette-launcher")!
  act(() => launcher.focus())
  openPalette(query)
  expect(translationOption()).toBeDefined()
  expect(host.querySelector(".translation-panel")).toBeNull()
  expect(create).not.toHaveBeenCalled()
  executeTranslation()
  expect(host.querySelector('[aria-label="Workspace Quick Pick"]')).toBeNull()
  expect(host.querySelectorAll(".translation-panel")).toHaveLength(1)
  expect(document.activeElement).toBe(host.querySelector('input[id$="-target"]'))
  expect(create).not.toHaveBeenCalled()
  act(() => document.activeElement!.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true })))
  expect(host.querySelector(".translation-panel")).toBeNull()
  expect(document.activeElement).toBe(host.querySelector(".translation-trigger"))
})

it("focuses an already open language panel instead of creating a second UI", async () => {
  await render()
  act(() => host.querySelector<HTMLButtonElement>(".translation-trigger")!.click())
  const panel = host.querySelector(".translation-panel")
  openPalette(">translate")
  executeTranslation()
  expect(host.querySelector(".translation-panel")).toBe(panel)
  expect(host.querySelectorAll(".translation-panel")).toHaveLength(1)
  expect(document.activeElement).toBe(host.querySelector('input[id$="-target"]'))
  expect(create).not.toHaveBeenCalled()
})

it("closes Settings before transferring a translation command to the article", async () => {
  await render()
  act(() => workbench.setSettingsOpen(true))
  expect(host.querySelector("#workbench-settings")).not.toBeNull()
  openPalette(">번역")
  executeTranslation()
  expect(host.querySelector("#workbench-settings")).toBeNull()
  expect(host.querySelector(".translation-panel")).not.toBeNull()
  expect(document.activeElement).toBe(host.querySelector('input[id$="-target"]'))
  expect(create).not.toHaveBeenCalled()
})

it("dismisses Quick Pick without closing the underlying language panel or stealing its focus", async () => {
  await render()
  act(() => host.querySelector<HTMLButtonElement>(".translation-trigger")!.click())
  const panel = host.querySelector(".translation-panel")
  const target = host.querySelector('input[id$="-target"]')
  openPalette(">translate")
  act(() => host.querySelector('[role="combobox"]')!.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true })))
  expect(host.querySelector('[aria-label="Workspace Quick Pick"]')).toBeNull()
  expect(host.querySelector(".translation-panel")).toBe(panel)
  expect(document.activeElement).toBe(target)
  expect(create).not.toHaveBeenCalled()
})

it("restores the launcher focus when the quick pick is dismissed without executing", async () => {
  await render()
  const launcher = host.querySelector<HTMLButtonElement>("#palette-launcher")!
  act(() => launcher.focus())
  openPalette(">translate")
  act(() => window.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true })))
  expect(document.activeElement).toBe(launcher)
  expect(host.querySelector(".translation-panel")).toBeNull()
  expect(create).not.toHaveBeenCalled()
})

it("invalidates captured route commands on navigation and removes them off article routes", async () => {
  await render()
  const firstOpen = workbench.articleTranslation!.open
  openPalette(">translate")
  await render("second")
  expect(workbench.articleTranslation?.slug).toBe("second")
  act(() => firstOpen())
  expect(host.querySelector(".translation-panel")).toBeNull()
  expect(translationOption()).toBeDefined()
  executeTranslation()
  expect(host.querySelector(".translation-panel")).not.toBeNull()
  const secondOpen = workbench.articleTranslation!.open
  await render(null)
  expect(workbench.articleTranslation).toBeNull()
  act(() => secondOpen())
  openPalette(">translate")
  expect(translationOption()).toBeUndefined()
  expect(host.querySelector(".translation-panel")).toBeNull()
  expect(create).not.toHaveBeenCalled()
})

it("does not register a translation command without the native Translator API", async () => {
  Reflect.deleteProperty(globalThis, "Translator")
  await render()
  openPalette(">translate")
  expect(workbench.articleTranslation).toBeNull()
  expect(translationOption()).toBeUndefined()
  expect(create).not.toHaveBeenCalled()
})
