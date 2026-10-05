import React, { act } from "react"
import { createRoot, type Root } from "react-dom/client"
import { ThemeProvider } from "@emotion/react"
import Router from "next/router"
import EditorShell from "src/layouts/RootLayout/EditorChrome/EditorShell"
import { createTheme } from "src/styles/theme"

jest.mock("next/router", () => {
  const listeners = new Map<string, Set<(...args: any[]) => void>>()
  const router = {
    pathname: "/",
    asPath: "/",
    query: {},
    beforePopState: jest.fn(),
    events: {
      on: (event: string, handler: (...args: any[]) => void) => {
        if (!listeners.has(event)) listeners.set(event, new Set())
        listeners.get(event)!.add(handler)
      },
      off: (event: string, handler: (...args: any[]) => void) => {
        listeners.get(event)?.delete(handler)
      },
      emit: (event: string, ...args: any[]) => {
        listeners.get(event)?.forEach((handler) => handler(...args))
      },
    },
  }
  return { __esModule: true, default: router, useRouter: () => router }
})

jest.mock("next/compat/router", () => ({
  useRouter: () => require("next/router").default,
}))
jest.mock("src/layouts/RootLayout/EditorChrome/ActivityBar", () => () => null)
jest.mock("src/layouts/RootLayout/EditorChrome/FileTree", () => () => null)
jest.mock("src/layouts/RootLayout/EditorChrome/TabBar", () => () => null)
jest.mock("src/layouts/RootLayout/EditorChrome/TitleBar", () => () => null)
jest.mock("src/layouts/RootLayout/EditorChrome/StatusBar", () => () => null)

;(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true

describe("document motion during browser history traversal", () => {
  let container: HTMLDivElement
  let root: Root
  let animate: jest.Mock
  const originalAnimate = Object.getOwnPropertyDescriptor(HTMLElement.prototype, "animate")

  beforeEach(() => {
    animate = jest.fn(() => ({ cancel: jest.fn() }))
    Object.defineProperty(HTMLElement.prototype, "animate", { configurable: true, value: animate })
    container = document.createElement("div")
    document.body.appendChild(container)
    root = createRoot(container)
    act(() => root.render(
      <ThemeProvider theme={createTheme({ scheme: "dark" })}>
        <EditorShell><article>Readable article</article></EditorShell>
      </ThemeProvider>
    ))
  })

  afterEach(() => {
    act(() => root.unmount())
    container.remove()
    if (originalAnimate) {
      Object.defineProperty(HTMLElement.prototype, "animate", originalAnimate)
    } else {
      Reflect.deleteProperty(HTMLElement.prototype, "animate")
    }
    jest.clearAllMocks()
  })

  const navigate = (url: string) => {
    act(() => Router.events.emit("routeChangeStart", url, { shallow: false }))
    expect(container.querySelector(".page-content")?.getAttribute("aria-busy")).toBe("true")
    act(() => Router.events.emit("routeChangeComplete", url, { shallow: false }))
    expect(container.querySelector(".page-content")?.getAttribute("aria-busy")).toBe("false")
  }

  it("skips entry for history, then permits ordinary visits including the previous history target", () => {
    navigate("/first")
    expect(animate).toHaveBeenCalledTimes(1)
    animate.mockClear()

    const beforePopState = (Router.beforePopState as jest.Mock).mock.calls[0][0]
    act(() => {
      expect(beforePopState({ url: "/[slug]", as: "/second", options: {} })).toBe(true)
    })
    navigate("/second")
    expect(animate).not.toHaveBeenCalled()

    navigate("/third")
    expect(animate).toHaveBeenCalledTimes(1)
    navigate("/second")
    expect(animate).toHaveBeenCalledTimes(2)
  })
})
