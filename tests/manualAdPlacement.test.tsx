import { renderToStaticMarkup } from "react-dom/server"
import type { Block, ExtendedRecordMap } from "notion-types"
import { NotionRenderer } from "react-notion-x"
import { CONFIG } from "site.config"
import { ArticleCode, ArticleEquation, ManualArticleAds } from "src/routes/Detail/components/NotionRenderer/ManualArticleAds"
import { planManualAdBoundaries } from "src/routes/Detail/components/NotionRenderer/manualAdPlacement"

jest.mock("site.config", () => ({ CONFIG: { googleAdsense: {
  enable: true,
  config: { client: "ca-pub-test", autoAdsDisabledConfirmed: true, slots: { article: "1234567890", postBottom: "" } },
} } }))

const rootId = "11111111111141118111111111111111"
const id = (index: number) => index.toString().padStart(32, "0")
function fixture(): ExtendedRecordMap {
  const make = (index: number, type: Block["type"], parent = rootId, content?: string[]) => ({
    id: id(index), type, parent_id: parent, parent_table: "block", version: 1,
    created_time: 0, last_edited_time: 0, alive: true,
    created_by_table: "notion_user", created_by_id: "author",
    last_edited_by_table: "notion_user", last_edited_by_id: "author",
    properties: { title: [[type === "code" ? "const intact = true" : `block ${index}`]], language: [["JavaScript"]], caption: [["Code caption"]] },
    ...(content ? { content } : {}),
  } as Block)
  const children = [make(1, "text"), make(2, "callout", rootId, [id(20)]), make(3, "quote", rootId, [id(21)]),
    make(4, "bulleted_list"), make(5, "bulleted_list"), make(6, "table", rootId, [id(22)]), make(7, "text"), make(8, "code"),
    make(9, "text"), make(10, "text"), make(11, "text"), make(12, "text")]
  const root = { ...make(0, "page", ""), id: rootId, content: children.map(block => block.id), permissions: [] }
  const table = children[5]
  table.format = { table_block_column_order: ["title"] }
  const blocks = [root, ...children, make(20, "code", id(2)), make(21, "equation", id(3)), make(22, "table_row", id(6))]
  return {
    block: Object.fromEntries(blocks.map(block => [block.id, { role: "reader", value: block }])),
    collection: {}, collection_view: {}, collection_query: {}, notion_user: {}, signed_urls: {},
  } as ExtendedRecordMap
}

beforeEach(() => {
  CONFIG.googleAdsense.config.autoAdsDisabledConfirmed = true
  CONFIG.googleAdsense.config.slots.article = "1234567890"
})

function render(recordMap: ExtendedRecordMap, enabled = true) {
  const host = document.createElement("div")
  host.innerHTML = renderToStaticMarkup(<ManualArticleAds recordMap={recordMap} enabled={enabled}>
    <NotionRenderer recordMap={recordMap} components={{ Code: ArticleCode, Equation: ArticleEquation }} />
  </ManualArticleAds>)
  return host
}

it("renders an actual manual unit beside complete code without changing nested native block DOM", () => {
  const host = render(fixture())
  const slots = host.querySelectorAll(".article-ad-slot")
  const slot = slots[0]
  expect(slot.previousElementSibling?.classList.contains("notion-code-figure")).toBe(true)
  expect(slot.previousElementSibling?.querySelector("figcaption")?.textContent).toBe("Code caption")
  expect(slot.closest(".notion-callout, .notion-quote, .notion-list, .notion-simple-table, .notion-code-figure")).toBeNull()
  expect(host.querySelector(".notion-callout .notion-code-figure code")?.textContent).toBe("const intact = true")
  expect(host.querySelector(".notion-quote .notion-equation-block")).not.toBeNull()
  expect(host.querySelector(".notion-simple-table td")?.textContent).toBe("block 22")
  expect(host.querySelectorAll(".notion-list > li")).toHaveLength(2)
})

it("creates no manual unit or spacer without the slot, confirmation, or article opt-in", () => {
  const recordMap = fixture()
  expect(render(recordMap, false).querySelector(".article-ad-slot")).toBeNull()
  CONFIG.googleAdsense.config.slots.article = ""
  expect(render(recordMap).querySelector(".article-ad-slot")).toBeNull()
  CONFIG.googleAdsense.config.slots.article = "1234567890"
  CONFIG.googleAdsense.config.autoAdsDisabledConfirmed = false
  expect(render(recordMap).querySelector(".article-ad-slot")).toBeNull()
})

it("does not insert ads into nested-only eligible blocks even when the page has enough content", () => {
  const recordMap = fixture()
  const root = recordMap.block[rootId].value as Block
  root.content = root.content!.filter(blockId => blockId !== id(8))
  expect([...planManualAdBoundaries(recordMap)]).toEqual([])
  expect(render(recordMap).querySelector(".article-ad-slot")).toBeNull()
})
