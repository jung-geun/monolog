import { act } from "react"
import { createRoot, type Root } from "react-dom/client"
import { ThemeProvider } from "@emotion/react"
import { createTheme } from "src/styles/theme"
import { resolveColorTheme } from "src/styles/colors"
import useArticleTranslation from "src/routes/Detail/PostDetail/useArticleTranslation"
import type { TranslationArticle } from "src/routes/Detail/PostDetail/articleTranslation"

;(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true

const first: TranslationArticle = { title: "첫 문장. 다음 문장.", summary: "", recordMap: null }
const second: TranslationArticle = { title: "다른 글입니다.", summary: "", recordMap: null }
const theme = createTheme({ colorTheme: resolveColorTheme("one-dark-pro-mix") })
function Harness({ article, slug }: { article: TranslationArticle; slug: string }) {
  const translation = useArticleTranslation(article, slug)
  return <ThemeProvider theme={theme}>{translation.controls}<output>{translation.article.title}</output></ThemeProvider>
}
function deferred<T>() {
  let resolve!: (value: T) => void
  const promise = new Promise<T>(done => { resolve = done })
  return { promise, resolve }
}
let host: HTMLDivElement
let root: Root
let previousTranslator: PropertyDescriptor | undefined
const create = jest.fn()
const availability = jest.fn()
const button = (text: string) => Array.from(host.querySelectorAll("button")).find(element => element.textContent === text)!
const title = () => host.querySelector("output")!.textContent
const render = async (article = first, slug = "first") => {
  await act(async () => { root.render(<Harness article={article} slug={slug} />) })
}

beforeEach(() => {
  previousTranslator = Object.getOwnPropertyDescriptor(globalThis, "Translator")
  availability.mockReset().mockResolvedValue("available")
  create.mockReset()
  Object.defineProperty(globalThis, "Translator", { configurable: true, value: { availability, create } })
  host = document.createElement("div")
  document.body.appendChild(host)
  root = createRoot(host)
})
afterEach(() => {
  act(() => root.unmount())
  host.remove()
  if (previousTranslator) Object.defineProperty(globalThis, "Translator", previousTranslator)
  else Reflect.deleteProperty(globalThis, "Translator")
})

it("does not create a model on mount or when opening translation controls", async () => {
  await render()
  act(() => host.querySelector("summary")!.click())
  expect(create).not.toHaveBeenCalled()
  expect(title()).toBe(first.title)
  expect(button("Translate article").disabled).toBe(false)
})

it("disposes a model that finishes creating after cancellation without translating", async () => {
  const pending = deferred<{ translate: jest.Mock; destroy: jest.Mock }>()
  const translator = { translate: jest.fn(), destroy: jest.fn() }
  create.mockReturnValue(pending.promise)
  await render()
  act(() => button("Translate article").click())
  const options = create.mock.calls[0][0]
  act(() => button("Cancel translation").click())
  await act(async () => pending.resolve(translator))
  expect(options.signal.aborted).toBe(true)
  expect(translator.destroy).toHaveBeenCalledTimes(1)
  expect(translator.translate).not.toHaveBeenCalled()
  expect(title()).toBe(first.title)
})

it("ignores an old sentence response after switching articles", async () => {
  const pending = deferred<string>()
  const translator = { translate: jest.fn(() => pending.promise), destroy: jest.fn() }
  create.mockResolvedValue(translator)
  await render()
  await act(async () => button("Translate article").click())
  await render(second, "second")
  await act(async () => pending.resolve("An old article."))
  expect(title()).toBe(second.title)
  expect(host.querySelector('[role="status"]')?.textContent).toBe("")
  expect(translator.destroy).toHaveBeenCalledTimes(1)
})

it("retains completed sentences on cancel and restores the original without accepting a late response", async () => {
  const pending = deferred<string>()
  const translator = { translate: jest.fn().mockResolvedValueOnce("First sentence.").mockReturnValueOnce(pending.promise), destroy: jest.fn() }
  create.mockResolvedValue(translator)
  await render()
  await act(async () => button("Translate article").click())
  expect(title()).toBe("First sentence. 다음 문장.")
  act(() => button("Cancel translation").click())
  expect(title()).toBe("First sentence. 다음 문장.")
  act(() => button("Restore original").click())
  await act(async () => pending.resolve("Second sentence."))
  expect(title()).toBe(first.title)
  expect(translator.translate).toHaveBeenCalledTimes(2)
})
