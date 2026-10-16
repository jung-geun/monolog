import { act } from "react"
import { hydrateRoot, type Root } from "react-dom/client"
import { renderToString } from "react-dom/server"
import type { Block, Decoration, ExtendedRecordMap, TextBlock } from "notion-types"
import { NotionContextProvider, Text } from "react-notion-x"
import { normalizeInlineMath } from "src/libs/utils/notion/inlineMath"
import { unwrapBlock } from "src/libs/utils/notion/unwrapBlock"
import { Equation } from "src/routes/Detail/components/NotionRenderer/Equation"

;(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true

const base: TextBlock = {
  id: "text", type: "text", parent_id: "page", parent_table: "block", version: 1,
  created_time: 0, last_edited_time: 0, alive: true,
  created_by_table: "notion_user", created_by_id: "author",
  last_edited_by_table: "notion_user", last_edited_by_id: "author",
  properties: { title: [] },
}

function fixture(mathProse: string, plainProse: string): ExtendedRecordMap {
  return {
    block: {
      text: { role: "reader", value: { ...base, properties: { title: [[mathProse]] } } },
      plain: { role: "reader", value: { ...base, id: "plain", properties: { title: [[plainProse]] } } },
    },
    collection: {}, collection_view: {}, collection_query: {}, notion_user: {}, signed_urls: {},
  } as ExtendedRecordMap
}

// Exercise RNX's real Fragment/Text fibers and e-decorator dispatch, not a
// hand-written <div>{text}</div> (React optimizes that into a different path).
function Preview({ recordMap }: { recordMap: ExtendedRecordMap }) {
  const normalized = normalizeInlineMath(recordMap)!
  const text = unwrapBlock(normalized.block.text)!
  const plain = unwrapBlock(normalized.block.plain)!
  return (
    <NotionContextProvider recordMap={normalized} components={{ Equation }}>
      <p data-testid="math"><Text value={text.properties!.title} block={text} /></p>
      <p data-testid="plain"><Text value={plain.properties!.title} block={plain} /></p>
    </NotionContextProvider>
  )
}

function withoutMath(element: Element) {
  const clone = element.cloneNode(true) as Element
  clone.querySelectorAll(".notion-equation").forEach((math) => math.remove())
  return clone.textContent
}

let container: HTMLDivElement
let root: Root | undefined

beforeEach(() => {
  container = document.createElement("div")
  document.body.appendChild(container)
})

afterEach(() => {
  if (root) act(() => root!.unmount())
  root = undefined
  container.remove()
})

it("SSR-renders math and visibly updates real RNX prose original → translated → original", async () => {
  const original = fixture("원문 앞 $x^2$ 원문 뒤.", "원문 일반 문장.")
  const translated = fixture("Translated before $x^2$ translated after.", "Translated plain sentence.")
  const sourceBefore = JSON.stringify(original)
  const translatedBefore = JSON.stringify(translated)
  const recoverableError = jest.fn()
  container.innerHTML = renderToString(<Preview recordMap={original} />)
  expect(container.querySelector(".katex")).not.toBeNull()
  expect(container.querySelector("math")).not.toBeNull()
  expect(withoutMath(container.querySelector('[data-testid="math"]')!)).toBe("원문 앞  원문 뒤.")
  const mathHTML = container.querySelector(".notion-equation")!.innerHTML

  await act(async () => {
    root = hydrateRoot(container, <Preview recordMap={original} />, { onRecoverableError: recoverableError })
  })
  expect(recoverableError).not.toHaveBeenCalled()

  await act(async () => root!.render(<Preview recordMap={translated} />))
  expect(withoutMath(container.querySelector('[data-testid="math"]')!)).toBe("Translated before  translated after.")
  expect(container.querySelector('[data-testid="plain"]')!.textContent).toBe("Translated plain sentence.")
  expect(container.textContent).not.toContain("원문")
  expect(container.querySelectorAll(".katex")).toHaveLength(1)
  expect(container.querySelector(".notion-equation")!.innerHTML).toBe(mathHTML)

  await act(async () => root!.render(<Preview recordMap={original} />))
  expect(withoutMath(container.querySelector('[data-testid="math"]')!)).toBe("원문 앞  원문 뒤.")
  expect(container.querySelector('[data-testid="plain"]')!.textContent).toBe("원문 일반 문장.")
  expect(container.textContent).not.toContain("Translated")
  expect(container.querySelectorAll(".katex")).toHaveLength(1)
  expect(JSON.stringify(original)).toBe(sourceBefore)
  expect(JSON.stringify(translated)).toBe(translatedBefore)
})

it("keeps all raw delimiter modes and official Notion inline/block math synchronous", () => {
  const original = fixture(String.raw`$a$ $$b$$ \(c\) \[d\]`, "Plain")
  const normalized = normalizeInlineMath(original)!
  const text = unwrapBlock(normalized.block.text)!
  const officialInline: Decoration[] = [["x^2", [["e", "x^2"]]]]
  const officialBlock = { ...base, id: "equation-id", type: "equation", properties: { title: [["y^2"]] } } as Block
  container.innerHTML = renderToString(
    <NotionContextProvider recordMap={normalized} components={{ Equation }}>
      <Text value={text.properties!.title} block={text} />
      <Text value={officialInline} block={text} />
      <Equation block={officialBlock} />
    </NotionContextProvider>,
  )
  expect(container.querySelectorAll(".katex")).toHaveLength(6)
  expect(container.querySelectorAll(".notion-equation-inline")).toHaveLength(3)
  expect(container.querySelectorAll(".katex-display")).toHaveLength(3)
  expect(container.querySelector(".notion-block-equationid .katex-display")).not.toBeNull()
})

it("rerenders changed math and a math-free translation without leaving old nodes", async () => {
  const original = fixture("Before $x$ after.", "Plain")
  container.innerHTML = renderToString(<Preview recordMap={original} />)
  await act(async () => { root = hydrateRoot(container, <Preview recordMap={original} />) })
  await act(async () => root!.render(<Preview recordMap={fixture("Avant $$y$$ après.", "Simple")} />))
  expect(withoutMath(container.querySelector('[data-testid="math"]')!)).toBe("Avant  après.")
  expect(container.querySelector(".katex-display")).not.toBeNull()
  expect(container.querySelector("annotation")!.textContent).toBe("y")
  await act(async () => root!.render(<Preview recordMap={fixture("Only plain text now.", "Simple")} />))
  expect(container.querySelector('[data-testid="math"]')!.textContent).toBe("Only plain text now.")
  expect(container.querySelector(".katex")).toBeNull()
  await act(async () => root!.render(<Preview recordMap={original} />))
  expect(withoutMath(container.querySelector('[data-testid="math"]')!)).toBe("Before  after.")
  expect(container.querySelectorAll(".katex")).toHaveLength(1)
})

it("does not trust authored KaTeX HTML/links and renders invalid TeX without throwing", () => {
  container.innerHTML = renderToString(
    <NotionContextProvider recordMap={fixture("", "")} components={{ Equation }}>
      <Equation math={String.raw`\href{javascript:alert(1)}{unsafe}`} inline />
      <Equation math={String.raw`\htmlClass{injected}{unsafe}`} inline />
      <Equation math={String.raw`\frac{invalid`} inline />
    </NotionContextProvider>,
  )
  expect(container.querySelector('a[href^="javascript:"]')).toBeNull()
  expect(container.querySelector(".injected")).toBeNull()
  expect(container.querySelector(".katex-error")).not.toBeNull()
})
