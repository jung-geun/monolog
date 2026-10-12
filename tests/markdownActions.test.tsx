import { act } from "react"
import { createRoot, type Root } from "react-dom/client"
import { ThemeProvider } from "@emotion/react"
import { createTheme } from "src/styles/theme"
import MarkdownActions from "src/routes/Detail/PostDetail/MarkdownActions"

;(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true

const markdown = '---\ntitle: "원본 글"\nslug: "first"\n---\n\n# 원본 글\n\n본문과 **Markdown**.\n'
const response = (text = markdown) => ({ ok: true, text: async () => text }) as Response
const fetchMarkdown = jest.fn<Promise<Response>, [input: RequestInfo | URL, init?: RequestInit]>()
const writeText = jest.fn<Promise<void>, [string]>()
const legacyCopy = jest.fn<boolean, [string]>()
let container: HTMLDivElement
let root: Root
let fetchDescriptor: PropertyDescriptor | undefined
let clipboardDescriptor: PropertyDescriptor | undefined
let legacyDescriptor: PropertyDescriptor | undefined

const render = (slug = "first") => act(() => root.render(
  <ThemeProvider theme={createTheme({ scheme: "dark" })}>
    <MarkdownActions slug={slug} />
  </ThemeProvider>,
))
const button = () => container.querySelector<HTMLButtonElement>('button[aria-label="Markdown 복사"]')!
const status = () => container.querySelector('[role="status"]')?.textContent

beforeEach(() => {
  fetchMarkdown.mockReset().mockResolvedValue(response())
  writeText.mockReset().mockResolvedValue(undefined)
  legacyCopy.mockReset().mockReturnValue(false)
  fetchDescriptor = Object.getOwnPropertyDescriptor(globalThis, "fetch")
  clipboardDescriptor = Object.getOwnPropertyDescriptor(navigator, "clipboard")
  legacyDescriptor = Object.getOwnPropertyDescriptor(document, "execCommand")
  Object.defineProperty(globalThis, "fetch", { configurable: true, value: fetchMarkdown })
  Object.defineProperty(navigator, "clipboard", { configurable: true, value: { writeText } })
  Object.defineProperty(document, "execCommand", { configurable: true, value: legacyCopy })
  container = document.createElement("div")
  document.body.appendChild(container)
  root = createRoot(container)
  render()
})

afterEach(() => {
  act(() => root.unmount())
  container.remove()
  for (const [object, key, descriptor] of [
    [globalThis, "fetch", fetchDescriptor],
    [navigator, "clipboard", clipboardDescriptor],
    [document, "execCommand", legacyDescriptor],
  ] as const) {
    if (descriptor) Object.defineProperty(object, key, descriptor)
    else Reflect.deleteProperty(object, key)
  }
})

it.each(["network", "HTTP", "body"])("does not copy a %s fetch failure, reports it truthfully, and allows retry", async failure => {
  if (failure === "network") fetchMarkdown.mockRejectedValueOnce(new Error("Offline"))
  else if (failure === "HTTP") fetchMarkdown.mockResolvedValueOnce({ ok: false, text: async () => "Unavailable" } as Response)
  else fetchMarkdown.mockResolvedValueOnce({ ok: true, text: async (): Promise<string> => { throw new Error("Body interrupted") } } as Response)

  await act(async () => button().click())
  expect(writeText).not.toHaveBeenCalled()
  expect(legacyCopy).not.toHaveBeenCalled()
  expect(status()).toBe("Markdown을 불러오지 못했습니다. 다시 시도해주세요.")
  expect(button().getAttribute("aria-disabled")).toBe("false")

  await act(async () => button().click())
  expect(status()).toBe("Markdown이 복사되었습니다.")
})

it.each(["response", "body"])("ignores a stale slug while awaiting the %s even when the transport ignores abort", async stage => {
  let finish!: () => void
  if (stage === "response") {
    fetchMarkdown.mockImplementationOnce(() => new Promise<Response>(resolve => { finish = () => resolve(response()) }))
  } else {
    fetchMarkdown.mockResolvedValueOnce({ ok: true, text: () => new Promise<string>(resolve => { finish = () => resolve(markdown) }) } as Response)
  }
  await act(async () => button().click())
  const signal = fetchMarkdown.mock.calls[0][1]?.signal
  render("second")
  expect(signal?.aborted).toBe(true)
  await act(async () => finish())
  expect(writeText).not.toHaveBeenCalled()
  expect(legacyCopy).not.toHaveBeenCalled()
  expect(status()).toBe("")

  await act(async () => button().click())
  expect(fetchMarkdown.mock.calls[1][0]).toBe("/second.md")
  expect(status()).toBe("Markdown이 복사되었습니다.")
})

it("uses the actual legacy copy flow after a denied clipboard write and restores focus", async () => {
  writeText.mockRejectedValueOnce(new DOMException("Permission denied", "NotAllowedError"))
  legacyCopy.mockImplementation(command => {
    expect(command).toBe("copy")
    const field = document.querySelector<HTMLTextAreaElement>('textarea[aria-hidden="true"]')!
    expect(field.value).toBe(markdown)
    expect(field.selectionStart).toBe(0)
    expect(field.selectionEnd).toBe(markdown.length)
    return true
  })
  button().focus()
  await act(async () => button().click())
  expect(legacyCopy).toHaveBeenCalledTimes(1)
  expect(document.querySelector("textarea")).toBeNull()
  expect(document.activeElement).toBe(button())
  expect(status()).toBe("Markdown이 복사되었습니다.")
})

it("does not announce success when both clipboard methods fail", async () => {
  writeText.mockRejectedValueOnce(new DOMException("Permission denied", "NotAllowedError"))
  button().focus()
  await act(async () => button().click())
  expect(status()).toBe("복사하지 못했습니다. 클립보드 권한을 확인해주세요.")
  expect(document.querySelector("textarea")).toBeNull()
  expect(document.activeElement).toBe(button())
  expect(button().getAttribute("aria-disabled")).toBe("false")
})

it("does not fall back or publish old feedback when navigation happens during a denied clipboard write", async () => {
  let reject!: (error: Error) => void
  writeText.mockImplementationOnce(() => new Promise<void>((_resolve, fail) => { reject = fail }))
  await act(async () => button().click())
  render("second")
  await act(async () => reject(new DOMException("Permission denied", "NotAllowedError")))
  expect(legacyCopy).not.toHaveBeenCalled()
  expect(status()).toBe("")
})
