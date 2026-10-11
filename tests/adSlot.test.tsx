import { act } from "react"
import { createRoot, type Root } from "react-dom/client"
import React from "react"
import AdSlot from "src/components/AdSlot"

jest.mock("site.config", () => ({
  CONFIG: {
    googleAdsense: {
      enable: true,
      config: { client: "ca-pub-1234567890123456" },
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
})
