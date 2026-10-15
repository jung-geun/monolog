import { act, type ReactNode } from "react"
import { createRoot, type Root } from "react-dom/client"
import RootLayout from "src/layouts/RootLayout"
import MarkdownSource from "src/routes/Detail/PostDetail/MarkdownSource"

jest.mock("next/compat/router", () => ({ useRouter: () => ({ asPath: "/about" }) }))
jest.mock("src/layouts/RootLayout/useGtagEffect", () => ({ __esModule: true, default: () => {} }))
jest.mock("src/layouts/RootLayout/EditorChrome/EditorShell", () => ({
  __esModule: true,
  default: ({ children }: { children: ReactNode }) => <main className="page-content">{children}</main>,
}))

;(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true

const markdown = "# About\n\n## Contact\n\nEmail: author@example.com"
let container: HTMLDivElement
let root: Root
const originalFetch = globalThis.fetch

beforeEach(() => {
  globalThis.fetch = jest.fn(async () => ({ ok: true, json: async () => ({ markdown, blocks: [{ blockId: "title", startLine: 1, endLine: 1 }, { blockId: "contact", startLine: 3, endLine: 3 }] }) } as Response))
  container = document.createElement("div")
  document.body.appendChild(container)
  root = createRoot(container)
})

afterEach(() => {
  act(() => root.unmount())
  container.remove()
  globalThis.fetch = originalFetch
})

it("preserves source lines and heading anchors when source is the first language code in a document", async () => {
  const article = <article className="notion-content"><h2 id="contact">Contact</h2><p>No preview code blocks.</p></article>
  act(() => root.render(<RootLayout>{article}</RootLayout>))
  await act(async () => {
    root.render(<RootLayout>{article}<div className="document-source"><MarkdownSource slug="about" headings={[{ id: "contact", text: "Contact", level: 2 }]} /></div></RootLayout>)
  })
  // Settle the same lazy grammar module the layout observer would use. The real
  // Prism implementation must not replace React-owned rows with one HTML string.
  await act(async () => { await import("src/layouts/RootLayout/prism") })

  expect(Array.from(container.querySelectorAll(".source-text"), line => line.textContent?.trimEnd())).toEqual(markdown.split("\n"))
  expect(Array.from(container.querySelectorAll(".source-number"), line => line.textContent)).toEqual(["1", "2", "3", "4", "5"])
  expect(container.querySelector('[data-source-heading="contact"] .source-text')?.textContent).toBe("## Contact")
})
