import { act } from "react"
import { createRoot, type Root } from "react-dom/client"
import { ThemeProvider } from "@emotion/react"
import { createTheme } from "src/styles/theme"
import { resolveColorTheme } from "src/styles/colors"
import type { TPost } from "src/types"
import SearchExperience from "src/routes/Search/SearchExperience"

const mockPosts: TPost[] = [
  { id: "rust", slug: "rust", title: "Rust systems", summary: "Storage recovery", tags: ["Rust"], category: ["Systems"], date: { start_date: "2026-10-01" }, createdTime: "2026-10-01", type: ["Post"], status: ["Public"], fullWidth: false },
  { id: "web", slug: "web", title: "Web navigation", summary: "Keyboard focus", tags: ["TypeScript"], category: ["Frontend"], date: { start_date: "2026-10-02" }, createdTime: "2026-10-02", type: ["Post"], status: ["Public"], fullWidth: false },
]
const mockRouter = { push: jest.fn() }
jest.mock("next/router", () => ({ useRouter: () => mockRouter }))
jest.mock("src/hooks/usePostsQuery", () => ({ __esModule: true, default: () => mockPosts }))

;(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true

let container: HTMLDivElement
let root: Root
const changeQuery = jest.fn()
const closeSidebar = jest.fn()
const selected = jest.fn()

function renderSearch(query = "", sidebar = false) {
  act(() => root.render(<ThemeProvider theme={createTheme({ colorTheme: resolveColorTheme("one-dark-pro-mix") })}>
    <SearchExperience query={query} onQueryChange={changeQuery} sidebar={sidebar} onEscape={closeSidebar} onSelect={selected} />
  </ThemeProvider>))
}

function keydown(target: EventTarget, key: string) {
  const event = new KeyboardEvent("keydown", { key, bubbles: true, cancelable: true })
  act(() => { target.dispatchEvent(event) })
  return event
}

beforeEach(() => {
  jest.clearAllMocks()
  container = document.createElement("div")
  document.body.appendChild(container)
  root = createRoot(container)
})
afterEach(() => {
  act(() => root.unmount())
  container.remove()
})

it("uses the same real filters in the sidebar without changing the document", () => {
  renderSearch("tag:rust category:systems", true)
  const links = container.querySelectorAll<HTMLAnchorElement>(".results a")
  expect(links).toHaveLength(1)
  expect(links[0].getAttribute("href")).toBe("/rust")
  expect(container.querySelector("mark")?.textContent).toBe("Systems")
  expect(mockRouter.push).not.toHaveBeenCalled()
  const editor = container.querySelector<HTMLAnchorElement>(".open-editor")!
  const destination = new URL(editor.href)
  expect(destination.pathname).toBe("/search")
  expect(destination.searchParams.get("q")).toBe("tag:rust category:systems")
})

it("moves actual focus with arrows and returns from the first result to the input", () => {
  renderSearch()
  const input = container.querySelector<HTMLInputElement>("input")!
  const links = container.querySelectorAll<HTMLAnchorElement>(".results a")
  input.focus()
  keydown(input, "ArrowDown")
  expect(document.activeElement).toBe(links[0])
  keydown(links[0], "ArrowDown")
  expect(document.activeElement).toBe(links[1])
  keydown(links[1], "ArrowUp")
  expect(document.activeElement).toBe(links[0])
  keydown(links[0], "ArrowUp")
  expect(document.activeElement).toBe(input)
  keydown(input, "ArrowUp")
  expect(document.activeElement).toBe(links[1])
  expect(mockRouter.push).not.toHaveBeenCalled()
})

it("opens the first matching entry with Enter only after explicit selection", () => {
  renderSearch("category:frontend", true)
  const input = container.querySelector<HTMLInputElement>("input")!
  expect(mockRouter.push).not.toHaveBeenCalled()
  keydown(input, "Enter")
  expect(mockRouter.push).toHaveBeenCalledWith("/web")
  expect(selected).toHaveBeenCalledTimes(1)
})

it("clears with Escape and closes an empty sidebar with Escape", () => {
  renderSearch("rust", true)
  const input = container.querySelector<HTMLInputElement>("input")!
  keydown(input, "Escape")
  expect(changeQuery).toHaveBeenCalledWith("")
  expect(closeSidebar).not.toHaveBeenCalled()
  expect(document.activeElement).toBe(input)
  renderSearch("", true)
  keydown(input, "Escape")
  expect(closeSidebar).toHaveBeenCalledTimes(1)
  expect(mockRouter.push).not.toHaveBeenCalled()
})
