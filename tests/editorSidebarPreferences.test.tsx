import React, { act } from "react"
import { createRoot } from "react-dom/client"
import { RouteChromeProvider, useRouteChrome, type RouteChromeContextValue } from "src/layouts/RootLayout/EditorChrome/RouteChromeContext"

jest.mock("next/compat/router", () => ({ useRouter: () => null }))

;(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true

it("keeps explicit desktop and mobile sidebar choices across the 960/961 boundary", () => {
  const original = window.matchMedia
  let mobile = false
  const listeners = new Set<() => void>()
  window.matchMedia = jest.fn().mockImplementation(() => ({
    get matches() { return mobile },
    addEventListener: (_event: string, callback: () => void) => listeners.add(callback),
    removeEventListener: (_event: string, callback: () => void) => listeners.delete(callback),
  }))
  let chrome: RouteChromeContextValue
  const State = () => { chrome = useRouteChrome(); return <span>{String(chrome.isFileTreeOpen)}</span> }
  const host = document.createElement("div")
  document.body.appendChild(host)
  const root = createRoot(host)
  const resize = (narrow: boolean) => act(() => { mobile = narrow; listeners.forEach(listener => listener()) })
  try {
    act(() => root.render(<RouteChromeProvider><State /></RouteChromeProvider>))
    expect(host.textContent).toBe("true")
    resize(true)
    expect(host.textContent).toBe("false")
    resize(false)
    expect(host.textContent).toBe("true")
    act(() => chrome.setFileTreeOpen(false))
    resize(true)
    act(() => chrome.toggleFileTree())
    expect(host.textContent).toBe("true")
    resize(false)
    expect(host.textContent).toBe("false")
    resize(true)
    expect(host.textContent).toBe("true")
    act(() => chrome.setFileTreeOpen(false))
    resize(false)
    act(() => chrome.setFileTreeOpen(true))
    resize(true)
    expect(host.textContent).toBe("false")
    resize(false)
    expect(host.textContent).toBe("true")
  } finally {
    act(() => root.unmount())
    host.remove()
    window.matchMedia = original
  }
  expect(listeners.size).toBe(0)
})
