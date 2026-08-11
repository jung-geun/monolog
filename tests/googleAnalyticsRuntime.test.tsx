import { act } from "react"
import { createRoot, type Root } from "react-dom/client"
import React from "react"

jest.mock("next/script", () => ({
  __esModule: true,
  default: ({ id, src }: { id?: string; src?: string }) => (
    <div data-testid={id || src} />
  ),
}))

import GoogleAnalytics from "src/components/GoogleAnalytics"

describe("GoogleAnalytics runtime configuration", () => {
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
    delete window.__MONOLOG_RUNTIME_CONFIG__
  })

  it("stays disabled when the container provides no measurement ID", () => {
    act(() => root.render(<GoogleAnalytics />))

    expect(container.querySelector('[data-testid="google-analytics"]')).toBeNull()
  })

  it("loads GA only from a valid runtime measurement ID", () => {
    window.__MONOLOG_RUNTIME_CONFIG__ = {
      googleMeasurementId: "G-TEST123",
      googleSiteVerification: "",
      naverSiteVerification: "",
    }

    act(() => root.render(<GoogleAnalytics />))

    expect(container.querySelector('[data-testid="google-analytics"]')).not.toBeNull()
    expect(
      container.querySelector(
        '[data-testid="https://www.googletagmanager.com/gtag/js?id=G-TEST123"]'
      )
    ).not.toBeNull()
  })
})
