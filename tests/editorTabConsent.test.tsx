import React, { act } from "react"
import { createRoot, type Root } from "react-dom/client"
import { ThemeProvider } from "@emotion/react"
import EditorShell from "src/layouts/RootLayout/EditorChrome/EditorShell"
import { useRegisterChrome, type TabKind } from "src/layouts/RootLayout/EditorChrome/RouteChromeContext"
import { createTheme } from "src/styles/theme"

const mockRouter = {
  pathname: "/",
  asPath: "/",
  query: {} as Record<string, string>,
  push: jest.fn(),
  events: { on: jest.fn(), off: jest.fn() },
}

jest.mock("next/compat/router", () => ({ useRouter: () => mockRouter }))
jest.mock("next/router", () => ({ __esModule: true, default: { beforePopState: jest.fn() } }))
jest.mock("src/layouts/RootLayout/EditorChrome/ActivityBar", () => () => null)
jest.mock("src/layouts/RootLayout/EditorChrome/FileTree", () => () => null)
jest.mock("src/layouts/RootLayout/EditorChrome/TitleBar", () => () => null)
jest.mock("src/layouts/RootLayout/EditorChrome/StatusBar", () => () => null)

;(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true

const consentKey = "monolog.editor-tabs.consent.v1"
const sessionKey = "monolog.editor-tabs.session.v1"
const statusItems = ["main"]

const Document = ({ kind }: { kind: TabKind }) => {
  useRegisterChrome(kind === "readme" ? "README.md" : "consent-note.md", statusItems, kind)
  return <article>Readable article remains available</article>
}

describe("editor tab consent choices", () => {
  let container: HTMLDivElement
  let root: Root

  beforeEach(() => {
    localStorage.clear()
    mockRouter.pathname = "/"
    mockRouter.asPath = "/"
    mockRouter.query = {}
    container = document.createElement("div")
    document.body.appendChild(container)
    root = createRoot(container)
  })

  afterEach(() => {
    act(() => root.unmount())
    container.remove()
    jest.restoreAllMocks()
    jest.clearAllMocks()
    localStorage.clear()
  })

  const render = (kind: TabKind) => {
    act(() => root.render(
      <ThemeProvider theme={createTheme({ scheme: "dark" })}>
        <EditorShell><Document kind={kind} /></EditorShell>
      </ThemeProvider>
    ))
  }

  const click = (label: string) => {
    const button = Array.from(container.querySelectorAll("button")).find(
      (candidate) => candidate.getAttribute("aria-label") === label || candidate.textContent === label
    )
    if (!button) throw new Error(`Button not found: ${label}`)
    act(() => button.click())
  }

  const openPost = () => {
    mockRouter.pathname = "/[slug]"
    mockRouter.asPath = "/consent-note"
    mockRouter.query = { slug: "consent-note" }
    render("post")
  }

  it("waits for a post, permits a write-free decline, and later opt-in and revocation through preferences", () => {
    const writes = jest.spyOn(Storage.prototype, "setItem")
    render("readme")
    expect(container.querySelector('[role="region"]')).toBeNull()
    expect(writes).not.toHaveBeenCalled()

    openPost()
    expect(writes).not.toHaveBeenCalled()
    click("저장 안함 (이번 방문)")
    expect(writes).not.toHaveBeenCalled()
    expect(localStorage.getItem(consentKey)).toBeNull()
    expect(localStorage.getItem(sessionKey)).toBeNull()
    expect(container.querySelector('[role="region"]')).toBeNull()
    expect(document.activeElement?.getAttribute("aria-label")).toBe("탭 저장 설정")

    click("탭 저장 설정")
    click("이 브라우저에 저장")
    expect(localStorage.getItem(consentKey)).toBe("enabled")
    expect(localStorage.getItem(sessionKey)).toContain("consent-note")

    click("탭 저장 설정")
    click("저장 해제 및 저장된 탭 삭제")
    expect(localStorage.getItem(consentKey)).toBeNull()
    expect(localStorage.getItem(sessionKey)).toBeNull()
    expect(container.querySelector('a[href="/consent-note"]')).not.toBeNull()
    writes.mockClear()
    click("consent-note.md 닫기")
    expect(writes).not.toHaveBeenCalled()
  })

  it("reopens a closed post using the visible control without enabling storage", () => {
    openPost()
    click("저장 안함 (이번 방문)")
    const reopen = container.querySelector('button[aria-label="마지막으로 닫은 글 다시 열기"]') as HTMLButtonElement
    expect(reopen.disabled).toBe(true)
    click("consent-note.md 닫기")
    expect(reopen.disabled).toBe(false)
    click("마지막으로 닫은 글 다시 열기")
    expect(mockRouter.push).toHaveBeenLastCalledWith("/consent-note")
    expect(container.querySelector('a[href="/consent-note"]')).not.toBeNull()
    expect(reopen.disabled).toBe(true)
    expect(localStorage.getItem(consentKey)).toBeNull()
    expect(localStorage.getItem(sessionKey)).toBeNull()
  })

  it("does not offer opt-in when stored consent cannot be read", () => {
    jest.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new DOMException("Storage blocked", "SecurityError")
    })
    const writes = jest.spyOn(Storage.prototype, "setItem")
    openPost()
    click("탭 저장 설정")
    expect(Array.from(container.querySelectorAll("button")).some((button) => button.textContent === "이 브라우저에 저장")).toBe(false)
    expect(container.querySelector('a[href="/consent-note"]')).not.toBeNull()
    expect(writes).not.toHaveBeenCalled()
  })

  it("lets the reader revoke and delete a previously saved session after quota failure", () => {
    openPost()
    click("이 브라우저에 저장")
    const saved = localStorage.getItem(sessionKey)
    const writes = jest.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new DOMException("Storage full", "QuotaExceededError")
    })
    mockRouter.asPath = "/another-note"
    render("post")
    expect(localStorage.getItem(consentKey)).toBe("enabled")
    expect(localStorage.getItem(sessionKey)).toBe(saved)
    click("탭 저장 설정")
    click("저장 해제 및 저장된 탭 삭제")
    expect(localStorage.getItem(consentKey)).toBeNull()
    expect(localStorage.getItem(sessionKey)).toBeNull()
    expect(container.querySelector('a[href="/consent-note"]')).not.toBeNull()
    expect(container.querySelector('a[href="/another-note"]')).not.toBeNull()
    writes.mockClear()
    mockRouter.asPath = "/third-note"
    render("post")
    expect(writes).not.toHaveBeenCalled()
  })
})
