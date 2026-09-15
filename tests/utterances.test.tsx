import { act } from "react"
import { createRoot, type Root } from "react-dom/client"
import React from "react"
import Utterances from "src/routes/Detail/PostDetail/CommentBox/Utterances"

jest.mock("src/hooks/useScheme", () => ({
  __esModule: true,
  default: () => ["dark"],
}))

;(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true

describe("Utterances", () => {
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
  })

  it("leaves the embed frame exclusively owned by the Utterances client", () => {
    act(() => root.render(<Utterances issueTerm="post-id" />))

    const comments = container.querySelector("#comments")
    const script = comments?.querySelector<HTMLScriptElement>(
      'script[src="https://utteranc.es/client.js"]'
    )

    expect(script).not.toBeNull()
    expect(comments?.querySelectorAll(".utterances-frame")).toHaveLength(0)
  })
})
