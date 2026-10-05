import { act } from "react"
import { createRoot, type Root } from "react-dom/client"
import React from "react"
import Router from "next/router"
import EditorShell from "src/layouts/RootLayout/EditorChrome/EditorShell"
import PostFooter from "src/routes/Detail/PostDetail/PostFooter"
import { createTheme } from "src/styles/theme"
import { ThemeProvider } from "@emotion/react"
jest.mock("src/hooks/useScheme", () => ({
  __esModule: true,
  default: () => ["dark"],
}))

jest.mock("src/hooks/useTagsQuery", () => ({
  __esModule: true,
  default: () => ({}),
  useTagsQuery: () => ({}),
}))

jest.mock("src/hooks/usePostsQuery", () => ({
  __esModule: true,
  default: () => [],
  usePostsQuery: () => [],
}))

jest.mock("src/hooks/useCategoriesQuery", () => ({
  __esModule: true,
  default: () => ({}),
  useCategoriesQuery: () => ({}),
}))

jest.mock("src/hooks/useSeriesQuery", () => ({
  __esModule: true,
  default: () => ({}),
  useSeriesQuery: () => ({}),
}))

;(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true

describe("Motion and Navigation lifecycle", () => {
  let container: HTMLDivElement
  let root: Root

  beforeEach(() => {
    container = document.createElement("div")
    document.body.appendChild(container)
    root = createRoot(container)
  })

  afterEach(() => {
    act(() => root.unmount())
    container.remove()
    jest.clearAllMocks()
  })

  it("registers beforePopState and sets aria-busy during route navigation in EditorShell", () => {
    const startHandlers: Array<(url: string, opts: { shallow: boolean }) => void> = []
    const completeHandlers: Array<(url: string) => void> = []
    const errorHandlers: Array<(err: unknown, url: string) => void> = []

    ;(Router.events.on as jest.Mock).mockImplementation((event: string, handler: any) => {
      if (event === "routeChangeStart") startHandlers.push(handler)
      if (event === "routeChangeComplete") completeHandlers.push(handler)
      if (event === "routeChangeError") errorHandlers.push(handler)
    })

    act(() => {
      root.render(
        <ThemeProvider theme={createTheme({ scheme: "dark" })}>
          <EditorShell>
            <div>Test Article Content</div>
          </EditorShell>
        </ThemeProvider>
      )
    })

    expect(Router.beforePopState).toHaveBeenCalled()
    const pageContent = container.querySelector(".page-content")
    expect(pageContent).not.toBeNull()
    expect(pageContent?.getAttribute("aria-busy")).toBe("false")

    // Simulate route navigation start
    act(() => {
      startHandlers.forEach((h) => h("/test-post", { shallow: false }))
    })
    expect(container.querySelector(".page-content")?.getAttribute("aria-busy")).toBe("true")

    // Simulate route navigation complete
    act(() => {
      completeHandlers.forEach((h) => h("/test-post"))
    })
    expect(container.querySelector(".page-content")?.getAttribute("aria-busy")).toBe("false")

    // Simulate route navigation error/cancel
    act(() => {
      startHandlers.forEach((h) => h("/cancelled-post", { shallow: false }))
    })
    expect(container.querySelector(".page-content")?.getAttribute("aria-busy")).toBe("true")

    act(() => {
      errorHandlers.forEach((h) => h({ cancelled: true }, "/cancelled-post"))
    })
    expect(container.querySelector(".page-content")?.getAttribute("aria-busy")).toBe("false")
  })

  it("PostFooter ↑ Top button uses auto scroll when prefers-reduced-motion is active", () => {
    const scrollToMock = jest.fn()
    window.scrollTo = scrollToMock

    const originalMatchMedia = window.matchMedia
    window.matchMedia = jest.fn().mockImplementation((query: string) => ({
      matches: query.includes("prefers-reduced-motion: reduce"),
      media: query,
      onchange: null,
      addListener: jest.fn(),
      removeListener: jest.fn(),
      addEventListener: jest.fn(),
      removeEventListener: jest.fn(),
      dispatchEvent: jest.fn(),
    }))

    act(() => {
      root.render(
        <ThemeProvider theme={createTheme({ scheme: "dark" })}>
          <PostFooter />
        </ThemeProvider>
      )
    })

    const topButton = Array.from(container.querySelectorAll("button")).find(
      (b) => b.textContent?.includes("Top")
    )
    expect(topButton).toBeDefined()

    act(() => {
      topButton?.click()
    })

    expect(scrollToMock).toHaveBeenCalledWith({
      top: 0,
      behavior: "auto",
    })

    window.matchMedia = originalMatchMedia
  })

  it("PostFooter ↑ Top button uses smooth scroll when prefers-reduced-motion is not active", () => {
    const scrollToMock = jest.fn()
    window.scrollTo = scrollToMock

    const originalMatchMedia = window.matchMedia
    window.matchMedia = jest.fn().mockImplementation(() => ({
      matches: false,
      media: "",
      onchange: null,
      addListener: jest.fn(),
      removeListener: jest.fn(),
      addEventListener: jest.fn(),
      removeEventListener: jest.fn(),
      dispatchEvent: jest.fn(),
    }))

    act(() => {
      root.render(
        <ThemeProvider theme={createTheme({ scheme: "dark" })}>
          <PostFooter />
        </ThemeProvider>
      )
    })

    const topButton = Array.from(container.querySelectorAll("button")).find(
      (b) => b.textContent?.includes("Top")
    )

    act(() => {
      topButton?.click()
    })

    expect(scrollToMock).toHaveBeenCalledWith({
      top: 0,
      behavior: "smooth",
    })

    window.matchMedia = originalMatchMedia
  })
})
