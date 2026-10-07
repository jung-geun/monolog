import { act } from "react"
import { createRoot, type Root } from "react-dom/client"
import type { CodeBlock } from "notion-types"
import { Code } from "src/routes/Detail/components/NotionRenderer/Code"

jest.mock("react-notion-x", () => ({
  useNotionContext: () => ({ recordMap: { block: {}, collection: {}, collection_view: {}, notion_user: {} } }),
  Text: () => null,
}))

jest.mock("notion-utils", () => ({ getBlockTitle: () => "fixture source" }))

;(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true

const block: CodeBlock = {
  id: "code-block",
  type: "code",
  parent_id: "page",
  parent_table: "block",
  version: 1,
  created_time: 0,
  last_edited_time: 0,
  alive: true,
  created_by_table: "notion_user",
  created_by_id: "author",
  last_edited_by_table: "notion_user",
  last_edited_by_id: "author",
  properties: {
    title: [["const active = true\n"]],
    language: [["JavaScript"]],
    caption: [],
  },
}

let container: HTMLDivElement
let root: Root
let clipboardDescriptor: PropertyDescriptor | undefined
let legacyCopyDescriptor: PropertyDescriptor | undefined
const legacyCopy = jest.fn(() => false)
const writeText = jest.fn(() => Promise.resolve())

beforeEach(() => {
  jest.useFakeTimers()
  writeText.mockReset()
  legacyCopy.mockReset().mockReturnValue(false)
  legacyCopyDescriptor = Object.getOwnPropertyDescriptor(document, "execCommand")
  Object.defineProperty(document, "execCommand", { configurable: true, value: legacyCopy })
  clipboardDescriptor = Object.getOwnPropertyDescriptor(navigator, "clipboard")
  Object.defineProperty(navigator, "clipboard", { configurable: true, value: { writeText } })
  container = document.createElement("div")
  document.body.appendChild(container)
  root = createRoot(container)
  act(() => root.render(<Code block={block} />))
})

afterEach(() => {
  act(() => root.unmount())
  container.remove()
  if (clipboardDescriptor) {
    Object.defineProperty(navigator, "clipboard", clipboardDescriptor)
  } else {
    Reflect.deleteProperty(navigator, "clipboard")
  }
  if (legacyCopyDescriptor) {
    Object.defineProperty(document, "execCommand", legacyCopyDescriptor)
  } else {
    Reflect.deleteProperty(document, "execCommand")
  }
  jest.useRealTimers()
})

it("does not announce success until the clipboard operation succeeds", async () => {
  let finish!: () => void
  writeText.mockImplementation(() => new Promise<void>(resolve => { finish = resolve }))
  const button = container.querySelector<HTMLButtonElement>("button")!

  act(() => button.click())
  expect(button.disabled).toBe(true)
  expect(document.querySelector('[role="status"]')).toBeNull()

  await act(async () => finish())
  expect(button.disabled).toBe(false)
  expect(document.querySelector('[role="status"]')?.textContent).toBe("복사되었습니다.")

  act(() => jest.runOnlyPendingTimers())
  expect(document.querySelector('[role="status"]')).toBeNull()
})

it("reports a denied clipboard write as failure and permits a later successful attempt", async () => {
  writeText.mockRejectedValueOnce(new DOMException("Permission denied", "NotAllowedError"))
  const button = container.querySelector<HTMLButtonElement>("button")!

  await act(async () => button.click())
  expect(button.disabled).toBe(false)
  expect(document.querySelector('[role="status"]')?.textContent).toBe("복사하지 못했습니다. 클립보드 권한을 확인해주세요.")

  writeText.mockResolvedValueOnce(undefined)
  await act(async () => button.click())
  expect(button.disabled).toBe(false)
  expect(document.querySelector('[role="status"]')?.textContent).toBe("복사되었습니다.")
})

it("retains successful copying and keyboard focus when only legacy clipboard support is available", async () => {
  Object.defineProperty(navigator, "clipboard", { configurable: true, value: undefined })
  legacyCopy.mockReturnValue(true)
  const button = container.querySelector<HTMLButtonElement>("button")!
  button.focus()

  await act(async () => button.click())

  expect(document.querySelector('[role="status"]')?.textContent).toBe("복사되었습니다.")
  expect(document.activeElement).toBe(button)
})
