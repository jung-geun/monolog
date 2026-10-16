import type { Block, Decoration, ExtendedRecordMap, TextBlock } from "notion-types"
import { normalizeInlineMath, parseInlineMath } from "src/libs/utils/notion/inlineMath"
import { unwrapBlock } from "src/libs/utils/notion/unwrapBlock"

const base: TextBlock = {
  id: "text", type: "text", parent_id: "page", parent_table: "block", version: 1,
  created_time: 0, last_edited_time: 0, alive: true,
  created_by_table: "notion_user", created_by_id: "author",
  last_edited_by_table: "notion_user", last_edited_by_id: "author",
  properties: { title: [] },
}

function mapOf(blocks: Block[], wrapped = false): ExtendedRecordMap {
  return {
    block: Object.fromEntries(blocks.map((block) => {
      const boxed = { role: "reader", value: block }
      return [block.id, wrapped ? { role: "reader", value: boxed } : boxed]
    })),
    collection: {}, collection_view: {}, collection_query: {}, notion_user: {}, signed_urls: {},
  } as ExtendedRecordMap
}

function freezeDeep(value: unknown) {
  if (!value || typeof value !== "object" || Object.isFrozen(value)) return
  Object.values(value).forEach(freezeDeep)
  Object.freeze(value)
}

it.each([
  { source: "$x+1$", math: "x+1", displayMode: false },
  { source: "$$x^2$$", math: "x^2", displayMode: true },
  { source: String.raw`\(x+1\)`, math: "x+1", displayMode: false },
  { source: String.raw`\[x^2\]`, math: "x^2", displayMode: true },
])("parses $source without losing its delimiters", ({ source, math, displayMode }) => {
  expect(parseInlineMath(`Before ${source} after.`)).toEqual([
    { type: "text", text: "Before " },
    { type: "math", text: source, math, displayMode },
    { type: "text", text: " after." },
  ])
})

it("keeps escaped delimiters as prose and skips escaped closers/nested braces inside math", () => {
  const source = String.raw`Cost \$5; escaped \\(x\\); $\text{a $ b {c}} + \$2$ and \(x\)y\).`
  const parts = parseInlineMath(source)
  expect(parts.filter((part) => part.type === "math")).toEqual([
    { type: "math", text: String.raw`$\text{a $ b {c}} + \$2$`, math: String.raw`\text{a $ b {c}} + \$2`, displayMode: false },
    { type: "math", text: String.raw`\(x\)`, math: "x", displayMode: false },
  ])
  expect(parts.map((part) => part.text).join("")).toBe(source)
})

it("does not close parenthesized math at an escaped right delimiter", () => {
  const source = String.raw`\(x\\) + y\)`
  expect(parseInlineMath(source)).toEqual([
    { type: "math", text: source, math: String.raw`x\\) + y`, displayMode: false },
  ])
})

it("ignores an escaped backslash before a real dollar opener", () => {
  expect(parseInlineMath(String.raw`\\$x$`)).toEqual([
    { type: "text", text: String.raw`\\` },
    { type: "math", text: "$x$", math: "x", displayMode: false },
  ])
})

it.each(["Costs $5 today.", "An unmatched $$ remains.", String.raw`Unmatched \(text`, "$x{y$", "Just prose."])("does not consume unmatched or plain prose: %s", (source) => {
  expect(parseInlineMath(source)).toEqual([{ type: "text", text: source }])
})

it("prefers display delimiters and preserves every source byte across mixed math", () => {
  const source = String.raw`A $$x$$, $y$, \(z\), \[w\]; $unmatched`
  const parts = parseInlineMath(source)
  expect(parts.filter((part) => part.type === "math").map((part) => part.displayMode)).toEqual([true, false, false, true])
  expect(parts.map((part) => part.text).join("")).toBe(source)
  expect(parts.at(-1)).toEqual({ type: "text", text: "; $unmatched" })
  expect(parseInlineMath("")).toEqual([])
})

it.each([false, true])("normalizes prose immutably and idempotently (wrapped=%s)", (wrapped) => {
  const decorations: NonNullable<Decoration[1]> = [["b"], ["a", "https://example.com/$unchanged$"]]
  const original = mapOf([
    { ...base, properties: { title: [["Before $x$ after.", decorations]] } },
    { ...base, id: "plain", properties: { title: [["Plain prose"]] } },
  ], wrapped)
  const before = JSON.stringify(original)
  freezeDeep(original)
  const normalized = normalizeInlineMath(original)!
  expect(normalized).not.toBe(original)
  expect(normalized.block.plain).toBe(original.block.plain)
  expect(normalized.collection).toBe(original.collection)
  expect(unwrapBlock(normalized.block.text)?.properties?.title).toEqual([
    ["Before ", decorations],
    ["$x$", [["e", "$x$"], ...decorations]],
    [" after.", decorations],
  ])
  expect(JSON.stringify(original)).toBe(before)
  expect(normalizeInlineMath(normalized)).toBe(normalized)
})

it("preserves code, official math, mentions and non-prose fields but normalizes captions and cells", () => {
  const protectedText: Decoration[] = [
    ["$inline code$", [["c"]]], ["x^2", [["e", "x^2"]]],
    ["$page$", [["p", "page"]]], ["$person$", [["u", "user"]]],
    ["‣", [["‣", ["u", "user"]]]],
  ]
  const code = { ...base, id: "code", type: "code", properties: {
    title: [["const cost = '$5$'"]], language: [["$language$"]], caption: [["Caption $c$"]],
  } } as Block
  const media = { ...base, id: "media", type: "image", properties: {
    source: [["https://example.com/$source$"]], caption: [["Caption $$m$$"]],
  } } as Block
  const row = { ...base, id: "row", type: "table_row", properties: { columnA: [["Cell \\(t\\)"]] } } as Block
  const equation = { ...base, id: "equation", type: "equation", properties: { title: [["x^2"]] } } as Block
  const original = mapOf([{ ...base, properties: { title: protectedText } }, code, media, row, equation])
  freezeDeep(original)
  const normalized = normalizeInlineMath(original)!
  expect(normalized.block.text).toBe(original.block.text)
  expect(normalized.block.equation).toBe(original.block.equation)
  expect(unwrapBlock(normalized.block.code)?.properties?.title).toBe(code.properties?.title)
  expect(unwrapBlock(normalized.block.code)?.properties?.language).toBe(code.properties?.language)
  expect(unwrapBlock(normalized.block.media)?.properties?.source).toBe(media.properties?.source)
  expect(unwrapBlock(normalized.block.code)?.properties?.caption).toEqual([["Caption "], ["$c$", [["e", "$c$"]]]])
  expect(unwrapBlock(normalized.block.media)?.properties?.caption).toEqual([["Caption "], ["$$m$$", [["e", "$$m$$"]]]])
  expect(unwrapBlock(normalized.block.row)?.properties?.columnA).toEqual([["Cell "], ["\\(t\\)", [["e", "\\(t\\)"]]]])
})

it("returns null and unchanged maps directly when no normalization is required", () => {
  expect(normalizeInlineMath(null)).toBeNull()
  const original = mapOf([{ ...base, properties: { title: [["Unmatched $5 price"]] } }])
  expect(normalizeInlineMath(original)).toBe(original)
})
