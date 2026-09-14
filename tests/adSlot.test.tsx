import { act } from "react"
import { createRoot, type Root } from "react-dom/client"
import React from "react"
import AdSlot from "src/components/AdSlot"

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

  it("renders and requests an enabled ad slot", () => {
    act(() => root.render(<AdSlot slot="1234567890" />))

    expect(
      container.querySelector(
        'ins.adsbygoogle[data-ad-client="ca-pub-6070999186513755"][data-ad-slot="1234567890"][data-ad-format="auto"][data-full-width-responsive="true"]'
      )
    ).not.toBeNull()
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
