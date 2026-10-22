import React, { act, useEffect } from "react"
import { createRoot, type Root } from "react-dom/client"
import { ThemeProvider } from "@emotion/react"
import { RouterContext } from "next/dist/shared/lib/router-context.shared-runtime"
import type { NextPageContext } from "next"
import type { NextRouter } from "next/router"
import NotFoundPage from "src/pages/404"
import ServerErrorPage from "src/pages/500"
import RuntimeErrorPage from "src/pages/_error"
import ErrorPage from "src/routes/Error"
import TabBar from "src/layouts/RootLayout/EditorChrome/TabBar"
import { RouteChromeProvider, useRouteChrome, type RouteChromeContextValue } from "src/layouts/RootLayout/EditorChrome/RouteChromeContext"
import { TAB_CONSENT_KEY, TAB_SESSION_KEY } from "src/layouts/RootLayout/EditorChrome/tabSessionStorage"
import { createTheme } from "src/styles/theme"
import { resolveColorTheme } from "src/styles/colors"

const mockRouter = {
  pathname: "/404", asPath: "/missing?view=preview#heading", query: {},
  push: jest.fn(), prefetch: jest.fn().mockResolvedValue(undefined), beforePopState: jest.fn(),
  events: { on: jest.fn(), off: jest.fn() },
}
jest.mock("next/compat/router", () => ({ useRouter: () => mockRouter }))

;(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true

let chrome: RouteChromeContextValue
const Probe = () => {
  const value = useRouteChrome()
  useEffect(() => { chrome = value }, [value])
  return null
}

describe("error page navigation", () => {
  let container: HTMLDivElement
  let root: Root
  const render = (page: React.ReactNode) => act(() => root.render(
    <RouterContext.Provider value={mockRouter as unknown as NextRouter}>
      <ThemeProvider theme={createTheme({ colorTheme: resolveColorTheme("one-dark-pro-mix") })}>
        <RouteChromeProvider><TabBar />{page}<Probe /></RouteChromeProvider>
      </ThemeProvider>
    </RouterContext.Provider>
  ))
  beforeEach(() => {
    mockRouter.asPath = "/missing?view=preview#heading"
    window.localStorage.removeItem(TAB_CONSENT_KEY)
    window.localStorage.removeItem(TAB_SESSION_KEY)
    container = document.createElement("div")
    document.body.appendChild(container)
    root = createRoot(container)
  })
  afterEach(() => {
    act(() => root.unmount())
    container.remove()
    window.localStorage.removeItem(TAB_CONSENT_KEY)
    window.localStorage.removeItem(TAB_SESSION_KEY)
    jest.clearAllMocks()
  })

  it("selects a closeable 404 tab at the rejected URL instead of Welcome", () => {
    render(<NotFoundPage />)
    const active = container.querySelector<HTMLAnchorElement>('.tab.active a[aria-current="page"]')!
    expect(active.getAttribute("href")).toBe(mockRouter.asPath)
    expect(chrome.activeTabId).toBe("/missing?view=preview")
    expect(chrome.tabs.find(tab => tab.id === chrome.activeTabId)?.kind).toBe("error")
    expect(container.querySelector('[data-error-code="404"]')).not.toBeNull()
    expect(container.querySelector('.tab.active button')).not.toBeNull()
    expect(container.querySelector('nav[aria-label="Error recovery"] a[href="/"]')).not.toBeNull()
    act(() => chrome.closeTab(chrome.activeTabId))
    expect(chrome.activeTabId).toBe("readme")
    expect(chrome.canReopenPost).toBe(false)
    expect(mockRouter.push.mock.calls).toEqual([["/"]])
  })

  it("does not duplicate an error tab across anchors or replace other open documents", () => {
    render(<NotFoundPage />)
    act(() => chrome.openTab({ id: "/existing", href: "/existing", label: "existing.md", kind: "post", closeable: true }))
    mockRouter.asPath = "/missing?view=preview#other"
    render(<NotFoundPage />)
    expect(chrome.activeTabId).toBe("/existing")
    mockRouter.asPath = "/another-missing"
    render(<NotFoundPage />)
    expect(chrome.tabs.map(tab => tab.id)).toEqual(["readme", "/missing?view=preview", "/existing", "/another-missing"])
    expect(chrome.activeTabId).toBe("/another-missing")
  })

  it("does not save failed routes as restored documents after consent", () => {
    render(<ServerErrorPage />)
    act(() => {
      chrome.allowTabStorage()
      chrome.openTab({ id: "/existing", href: "/existing", label: "existing.md", kind: "post", closeable: true })
    })
    const stored = JSON.parse(window.localStorage.getItem(TAB_SESSION_KEY)!)
    expect(stored.tabs.map((tab: { id: string }) => tab.id)).toEqual(["readme", "/existing"])
    expect(container.querySelector('[data-error-code="500"] button')).not.toBeNull()
  })

  it("keeps a failed home route distinct from the permanent Welcome tab", () => {
    mockRouter.asPath = "/"
    render(<ServerErrorPage />)
    expect(chrome.tabs.map(tab => [tab.id, tab.kind])).toEqual([["readme", "readme"], ["/", "error"]])
    expect(chrome.activeTabId).toBe("/")
    expect(container.querySelector('.tab.active a')?.getAttribute("href")).toBe("/")
  })

  it("recovers the same tab identity when its document becomes available", () => {
    render(<NotFoundPage />)
    act(() => chrome.openTab({ id: "/missing?view=preview", href: mockRouter.asPath, label: "recovered.md", kind: "post", closeable: true }))
    expect(chrome.tabs.map(tab => [tab.id, tab.kind])).toEqual([["readme", "readme"], ["/missing?view=preview", "post"]])
    act(() => chrome.closeActivePost())
    expect(chrome.canReopenPost).toBe(true)
  })

  it.each([0, 200, 600, NaN, null])("does not misreport an unclassified client failure (%s) as an HTTP 404", (statusCode) => {
    render(<ErrorPage statusCode={statusCode} />)
    expect(container.querySelector('[data-error-code="ERR"]')).not.toBeNull()
    expect(chrome.tabs.find(tab => tab.id === chrome.activeTabId)?.kind).toBe("error")
  })
})

describe("runtime HTTP error classification", () => {
  it.each([
    [503, 404, 503],
    [500, undefined, 500],
    [200, 403, 403],
    [undefined, 502, 502],
    [undefined, undefined, null],
  ])("preserves response status %s ahead of exception status %s", async (responseStatus, errorStatus, expected) => {
    const context = {
      res: responseStatus === undefined ? undefined : { statusCode: responseStatus },
      err: Object.assign(new Error("private diagnostic"), errorStatus === undefined ? {} : { statusCode: errorStatus }),
    } as NextPageContext
    expect(await RuntimeErrorPage.getInitialProps!(context)).toEqual({ statusCode: expected })
  })
})
