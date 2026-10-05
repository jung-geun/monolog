import React from "react"
import { renderToStaticMarkup } from "react-dom/server"
import MetaConfig from "src/components/MetaConfig"

jest.mock("next/head", () => {
  return {
    __esModule: true,
    default: ({ children }: { children: React.ReactNode }) => (
      <>{children}</>
    ),
  }
})


describe("MetaConfig", () => {
  const defaultProps = {
    title: "Test Title",
    description: "Test Description",
    type: "Post",
    url: "https://blog.pieroot.xyz/test-post",
  }

  it("renders exact link rel='alternate' type='text/markdown' when alternateMarkdownUrl is supplied", () => {
    const props = {
      ...defaultProps,
      alternateMarkdownUrl: "https://blog.pieroot.xyz/test-post.md",
    }

    const markup = renderToStaticMarkup(<MetaConfig {...props} />)

    expect(markup).toContain(
      '<link rel="alternate" type="text/markdown" href="https://blog.pieroot.xyz/test-post.md"/>'
    )
  })

})
