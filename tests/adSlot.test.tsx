import { act } from "react"
import { createRoot, type Root } from "react-dom/client"
import React from "react"
import AdSlot from "src/components/AdSlot"
import { CONFIG } from "site.config"

const mockRouter = { asPath: "/article" }
jest.mock("next/router", () => ({ useRouter: () => mockRouter }))

jest.mock("site.config", () => ({
  CONFIG: {
    googleAdsense: {
      enable: true,
      config: {
        client: "ca-pub-1234567890123456",
        mode: "manual",
        autoAdsInPageDisabledConfirmed: false,
        autoAdsDisabledConfirmed: true,
        slots: { article: "1234567890", postBottom: "" },
      },
    },
  },
}))

;(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true

describe("AdSlot", () => {
  let container: HTMLDivElement
  let root: Root
  const originalOffsetWidth = Object.getOwnPropertyDescriptor(
    HTMLElement.prototype,
    "offsetWidth"
  )

  beforeEach(() => {
    mockRouter.asPath = "/article"
    CONFIG.googleAdsense.config.mode = "manual"
    CONFIG.googleAdsense.config.autoAdsInPageDisabledConfirmed = false
    CONFIG.googleAdsense.config.autoAdsDisabledConfirmed = true
    CONFIG.googleAdsense.config.slots.article = "1234567890"
    Object.defineProperty(HTMLElement.prototype, "offsetWidth", {
      configurable: true,
      get: () => 300,
    })
    window.adsbygoogle = []
    container = document.createElement("div")
    document.body.appendChild(container)
    root = createRoot(container)
  })

  afterEach(() => {
    act(() => root.unmount())
    container.remove()
    delete window.adsbygoogle
    jest.restoreAllMocks()
    if (originalOffsetWidth) {
      Object.defineProperty(
        HTMLElement.prototype,
        "offsetWidth",
        originalOffsetWidth
      )
    } else {
      Reflect.deleteProperty(HTMLElement.prototype, "offsetWidth")
    }
  })

  it("renders nothing when the slot is empty", () => {
    act(() => root.render(<AdSlot slot="" />))

    expect(container.querySelector("ins.adsbygoogle")).toBeNull()
    expect(window.adsbygoogle).toHaveLength(0)
  })

  it("requests a configured visible ad slot once across rerenders", () => {
    act(() => root.render(<AdSlot slot="1234567890" />))

    expect(window.adsbygoogle).toHaveLength(1)
    act(() => root.render(<AdSlot slot="1234567890" />))
    expect(window.adsbygoogle).toHaveLength(1)
  })

  it("does not request a slot inside a hidden container", () => {
    Object.defineProperty(HTMLElement.prototype, "offsetWidth", {
      configurable: true,
      get: () => 0,
    })

    act(() => root.render(<AdSlot slot="1234567890" />))

    expect(container.querySelector("ins.adsbygoogle")).not.toBeNull()
    expect(window.adsbygoogle).toHaveLength(0)
  })

  it("fails closed without the operator's Auto ads OFF confirmation", () => {
    CONFIG.googleAdsense.config.autoAdsDisabledConfirmed = false
    act(() => root.render(<AdSlot slot="1234567890" />))
    expect(container.querySelector("ins.adsbygoogle")).toBeNull()
    expect(window.adsbygoogle).toHaveLength(0)
  })

  it("fails closed when no real manual units are configured", () => {
    CONFIG.googleAdsense.config.slots.article = ""
    act(() => root.render(<AdSlot slot="1234567890" />))
    expect(container.querySelector("ins.adsbygoogle")).toBeNull()
    expect(window.adsbygoogle).toHaveLength(0)
  })

  it("does not mount or request manual units in automatic mode with in-page-off confirmation", () => {
    CONFIG.googleAdsense.config.mode = "auto"
    CONFIG.googleAdsense.config.autoAdsInPageDisabledConfirmed = true
    act(() => root.render(<AdSlot slot="1234567890" />))
    expect(container.querySelector("ins.adsbygoogle")).toBeNull()
    expect(window.adsbygoogle).toHaveLength(0)
  })

  it("replaces a served unit when the requested slot changes", () => {
    act(() => root.render(<AdSlot slot="1234567890" />))
    const first = container.querySelector("ins.adsbygoogle")!
    first.setAttribute("data-adsbygoogle-status", "done")
    act(() => root.render(<AdSlot slot="9876543210" />))
    expect(container.querySelector("ins.adsbygoogle")).not.toBe(first)
    expect(window.adsbygoogle).toHaveLength(2)
  })

  it("retains a served unit for same-article hashes and queries but replaces it for another article", () => {
    const render = () => act(() => root.render(<AdSlot slot="1234567890" />))
    render()
    const first = container.querySelector("ins.adsbygoogle")!
    first.setAttribute("data-adsbygoogle-status", "done")
    const creative = document.createElement("iframe")
    first.appendChild(creative)
    mockRouter.asPath = "/article?view=preview#heading"
    render()
    expect(container.querySelector("ins.adsbygoogle")).toBe(first)
    expect(creative.isConnected).toBe(true)
    expect(window.adsbygoogle).toHaveLength(1)
    mockRouter.asPath = "/other-article?view=preview#heading"
    render()
    expect(container.querySelector("ins.adsbygoogle")).not.toBe(first)
    expect(creative.isConnected).toBe(false)
    expect(window.adsbygoogle).toHaveLength(2)
  })

  it("queues a hidden slot exactly once when its pane becomes visible", () => {
    let width = 0
    Object.defineProperty(HTMLElement.prototype, "offsetWidth", { configurable: true, get: () => width })
    let onResize: ResizeObserverCallback = () => {}
    const observe = jest.fn()
    const disconnect = jest.fn()
    jest.spyOn(globalThis, "ResizeObserver").mockImplementation(callback => {
      onResize = callback
      return { observe, disconnect, unobserve: jest.fn() }
    })

    act(() => root.render(<AdSlot slot="1234567890" />))
    const ins = container.querySelector("ins.adsbygoogle")!
    expect(observe).toHaveBeenCalledWith(ins)
    expect(window.adsbygoogle).toHaveLength(0)
    width = 300
    act(() => onResize([], {} as ResizeObserver))
    act(() => onResize([], {} as ResizeObserver))
    expect(window.adsbygoogle).toHaveLength(1)
    expect(disconnect).toHaveBeenCalled()
  })

  it("does not double-queue before Google sets status when Strict Mode replays effects", () => {
    act(() => root.render(<React.StrictMode><AdSlot slot="1234567890" /></React.StrictMode>))
    expect(window.adsbygoogle).toHaveLength(1)
    expect(container.querySelector("ins.adsbygoogle")?.hasAttribute("data-adsbygoogle-status")).toBe(false)
  })
})
