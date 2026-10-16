import { act, type ReactNode } from "react"
import { createRoot, type Root } from "react-dom/client"
import RootLayout from "src/layouts/RootLayout"
import MarkdownSource from "src/routes/Detail/PostDetail/MarkdownSource"
import type { MarkdownDocument } from "src/libs/utils/notion/markdown"

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

it("displays incoming translated rows immediately and remaps stable heading/block identities", () => {
  const headingId = "ABCDEFAB-1234-5678-9012-ABCDEFABCDEF"
  const blockId = headingId.replace(/-/g, "").toLowerCase()
  const initial: MarkdownDocument = {
    markdown: "# Título\n\n## Contacto\n\n`const url = 'https://example.com/a_(b)'`\n\n$x_1 + y$\n",
    blocks: [
      { blockId: "title", startLine: 1, endLine: 1 },
      { blockId, startLine: 3, endLine: 3 },
      { blockId: "code", startLine: 5, endLine: 5 },
      { blockId: "equation", startLine: 7, endLine: 7 },
    ],
  }
  const headings = [{ id: headingId, text: "Contacto", level: 2 }]
  const view = (document: MarkdownDocument) => <RootLayout><MarkdownSource slug="about" headings={headings} document={document} language="es" /></RootLayout>
  act(() => root.render(view(initial)))
  expect(Array.from(container.querySelectorAll(".source-text"), line => line.textContent)).toEqual(initial.markdown.split("\n").map(line => line || " "))
  expect(container.querySelector('[aria-label="Read-only Markdown source"]')?.getAttribute("lang")).toBe("es")
  expect(container.querySelector(`[data-source-heading="${headingId}"]`)?.getAttribute("data-source-block")).toBe(blockId)

  const next: MarkdownDocument = {
    markdown: initial.markdown.replace("# Título\n\n", "# Título traducido\n\nResumen\nsegunda línea\n\n"),
    blocks: [
      { blockId: "title", startLine: 1, endLine: 1 },
      { blockId: "summary", startLine: 3, endLine: 4 },
      ...initial.blocks.slice(1).map(block => ({ ...block, startLine: block.startLine + 3, endLine: block.endLine + 3 })),
    ],
  }
  act(() => root.render(view(next)))
  expect(Array.from(container.querySelectorAll(".source-text"), line => line.textContent)).toEqual(next.markdown.split("\n").map(line => line || " "))
  const heading = container.querySelector(`[data-source-heading="${headingId}"]`)
  expect(heading?.getAttribute("data-source-line")).toBe("6")
  expect(heading?.querySelector(".source-text")?.textContent).toBe("## Contacto")
  expect(container.querySelector('[data-source-block="code"] .source-text')?.textContent).toBe("`const url = 'https://example.com/a_(b)'`")
  expect(container.querySelector('[data-source-block="equation"] .source-text')?.textContent).toBe("$x_1 + y$")
  expect(container.querySelector('[data-source-heading][data-source-line="3"]')).toBeNull()
})

it("ignores an in-flight original response during translation and restores without stale translated rows", async () => {
  const pending: ((response: Response) => void)[] = []
  globalThis.fetch = jest.fn(() => new Promise<Response>(resolve => pending.push(resolve)))
  const response = () => ({ ok: true, json: async () => ({ markdown, blocks: [{ blockId: "contact", startLine: 3, endLine: 3 }] }) } as Response)
  const headings = [{ id: "contact", text: "Contact", level: 2 }]
  const translated: MarkdownDocument = {
    markdown: "# Acerca de\n\n## Contacto\n",
    blocks: [{ blockId: "contact", startLine: 3, endLine: 3 }],
  }
  const view = (document?: MarkdownDocument) => <RootLayout><MarkdownSource slug="about" headings={headings} document={document} /></RootLayout>
  act(() => root.render(view()))
  act(() => root.render(view(translated)))
  await act(async () => { pending[0](response()) })
  expect(container.querySelector('[data-source-heading="contact"] .source-text')?.textContent).toBe("## Contacto")

  act(() => root.render(view()))
  expect(container.querySelector(".source-line")).toBeNull()
  expect(container.textContent).not.toContain("Acerca de")
  await act(async () => { pending[1](response()) })
  expect(container.querySelector('[data-source-heading="contact"] .source-text')?.textContent).toBe("## Contact")
  expect(container.textContent).not.toContain("Contacto")
})

it("restores the retained original while offline without fetching it again", async () => {
  const headings = [{ id: "contact", text: "Contact", level: 2 }]
  const translated: MarkdownDocument = {
    markdown: "# Acerca de\n\n## Contacto\n",
    blocks: [{ blockId: "contact", startLine: 3, endLine: 3 }],
  }
  const view = (document?: MarkdownDocument) => <RootLayout><MarkdownSource slug="about" headings={headings} document={document} /></RootLayout>
  await act(async () => root.render(view()))
  expect(container.querySelector('[data-source-heading="contact"] .source-text')?.textContent).toBe("## Contact")
  act(() => root.render(view(translated)))
  expect(container.querySelector('[data-source-heading="contact"] .source-text')?.textContent).toBe("## Contacto")
  const offlineFetch = jest.fn().mockRejectedValue(new TypeError("Offline"))
  globalThis.fetch = offlineFetch
  await act(async () => root.render(view()))
  expect(offlineFetch).not.toHaveBeenCalled()
  expect(container.querySelector('[data-source-heading="contact"] .source-text')?.textContent).toBe("## Contact")
  expect(container.textContent).not.toContain("Contacto")
})
