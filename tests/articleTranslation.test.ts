import type { Block, ExtendedRecordMap } from "notion-types"
import {
  createTranslationPlan,
  type TranslationArticle,
  type TranslationPlan,
} from "src/routes/Detail/PostDetail/articleTranslation"
import { unwrapBlock } from "src/libs/utils/notion/unwrapBlock"

const ROOT = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa"

function recordMap(blocks: Record<string, Record<string, unknown>>, content = Object.keys(blocks)): ExtendedRecordMap {
  const entries: ExtendedRecordMap["block"] = {}
  for (const [id, value] of Object.entries({
    [ROOT]: { type: "page", content, properties: { title: [["Original page title"]] } },
    ...blocks,
  })) {
    entries[id] = {
      role: "reader",
      value: Object.assign({ id, version: 1, type: "text" }, value) as Block,
    }
  }
  return {
    block: entries,
    collection: {},
    collection_view: {},
    collection_query: {},
    notion_user: {},
    signed_urls: {},
  }
}

function article(map: ExtendedRecordMap | null = null): TranslationArticle {
  return { title: "Article title", summary: "Article summary.", recordMap: map }
}

function translated(plan: TranslationPlan): Map<number, string> {
  return new Map(plan.texts.map((text, index) => [index, `Translated ${text}`]))
}

function properties(map: ExtendedRecordMap, id: string): Record<string, unknown> {
  return unwrapBlock(map.block[id])!.properties as Record<string, unknown>
}

function freeze(value: unknown): void {
  if (!value || typeof value !== "object" || Object.isFrozen(value)) return
  for (const child of Object.values(value)) freeze(child)
  Object.freeze(value)
}

it("collects metadata first and sentences sequentially while preserving whitespace", () => {
  const original: TranslationArticle = {
    title: "  First title.\tSecond title!  ",
    summary: "\nA summary.\r\nAnother phrase\t ",
    recordMap: recordMap({ body: { properties: { title: [[" \tHello world.  Next sentence!\nLast phrase  "]] } } }),
  }
  const plan = createTranslationPlan(original, "en-US")
  expect(plan.texts).toEqual([
    "First title.", "Second title!", "A summary.", "Another phrase",
    "Hello world.", "Next sentence!", "Last phrase",
  ])
  const result = plan.apply(new Map(plan.texts.map((_, index) => [index, `  Translation ${index} \n`])))
  expect(result.title).toBe("  Translation 0\tTranslation 1  ")
  expect(result.summary).toBe("\nTranslation 2\r\nTranslation 3\t ")
  expect(properties(result.recordMap!, "body").title).toEqual([[" \tTranslation 4  Translation 5\nTranslation 6  "]])
})

it("supports the configured Korean source language and Unicode sentence boundaries", () => {
  const original = { title: "안녕하세요. 다음 문장입니다.", summary: "요약입니다.", recordMap: null }
  const plan = createTranslationPlan(original, "ko-KR")
  expect(plan.texts).toEqual(["안녕하세요.", "다음 문장입니다.", "요약입니다."])
  expect(plan.apply(new Map([[0, "Hello."], [1, "Next sentence."], [2, "Summary."]]))).toEqual({
    title: "Hello. Next sentence.", summary: "Summary.", recordMap: null,
  })
})

it.each([
  "text", "paragraph", "header", "sub_header", "sub_sub_header", "header_4",
  "bulleted_list", "numbered_list", "to_do", "callout", "quote", "toggle",
])("collects %s prose without translating other properties", type => {
  const map = recordMap({ prose: {
    type,
    properties: { title: [["Visible prose"]], checked: [["Yes"]], language: [["python"]], source: [["https://example.com"]] },
  } })
  const plan = createTranslationPlan(article(map), "en")
  expect(plan.texts).toEqual(["Article title", "Article summary.", "Visible prose"])
  const result = plan.apply(translated(plan))
  expect(properties(result.recordMap!, "prose")).toEqual({
    title: [["Translated Visible prose"]], checked: [["Yes"]], language: [["python"]], source: [["https://example.com"]],
  })
})

it("translates captions, including code captions, but skips code contents and equations", () => {
  const map = recordMap({
    code: { type: "code", properties: { title: [["console.log('do not translate')"]], language: [["javascript"]], caption: [["Code caption"]] } },
    math: { type: "equation", properties: { title: [["x + y"]], caption: [["Not visible prose"]] } },
    image: { type: "image", properties: { source: [["https://example.com/image.png"]], caption: [["Image caption"]] } },
    video: { type: "video", properties: { caption: [["Video caption"]] } },
  })
  const plan = createTranslationPlan(article(map), "en")
  expect(plan.texts).toEqual(["Article title", "Article summary.", "Code caption", "Image caption", "Video caption"])
  const result = plan.apply(translated(plan)).recordMap!
  expect(properties(result, "code").title).toBe(properties(map, "code").title)
  expect(properties(result, "code").language).toBe(properties(map, "code").language)
  expect(properties(result, "code").caption).toEqual([["Translated Code caption"]])
  expect(result.block.math).toBe(map.block.math)
})

it("translates realistic bookmark titles, descriptions and captions without touching destination metadata", () => {
  // Production bookmark conversion puts the supplied caption in title, while
  // cached/legacy bookmarks can also expose description and caption separately.
  const annotations = [["b"], ["a", "https://developer.mozilla.org/en-US/docs/Web/JavaScript/Closures"]]
  const map = recordMap({
    bookmark: {
      type: "bookmark",
      properties: {
        title: [["JavaScript closures explained", annotations]],
        description: [["Learn how closures capture lexical scope. See developer.mozilla.org for examples."]],
        caption: [["A practical reference"]],
        link: [["https://developer.mozilla.org/en-US/docs/Web/JavaScript/Closures"]],
        source: [["https://developer.mozilla.org/static/preview.png"]],
      },
      format: { bookmark_icon: "https://developer.mozilla.org/favicon.ico" },
    },
    fallback: { type: "bookmark", properties: { title: [["example.com/docs"]], link: [["example.com/docs"]] } },
  })
  const plan = createTranslationPlan(article(map), "en")
  expect(plan.texts).toEqual([
    "Article title", "Article summary.", "JavaScript closures explained",
    "Learn how closures capture lexical scope.", "See", "for examples.", "A practical reference",
  ])
  const next = plan.apply(translated(plan)).recordMap!
  const result = properties(next, "bookmark")
  expect(result.title).toEqual([["Translated JavaScript closures explained", annotations]])
  expect(result.description).toEqual([["Translated Learn how closures capture lexical scope. Translated See developer.mozilla.org Translated for examples."]])
  expect(result.caption).toEqual([["Translated A practical reference"]])
  expect(result.link).toBe(properties(map, "bookmark").link)
  expect(result.source).toBe(properties(map, "bookmark").source)
  expect(unwrapBlock(next.block.bookmark)?.format).toBe(unwrapBlock(map.block.bookmark)?.format)
  expect(next.block.fallback).toBe(map.block.fallback)
})

it.each([
  "example.com/docs?lang=en#guide",
  "192.168.1.10:8080/gallery",
  "https://example.com/docs",
  "/bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
])("preserves the entire image navigation caption and its href when the first tuple is %s", href => {
  const caption = [
    [href, [["a", "https://example.com/annotation-target"]], { retained: true }],
    ["  This hidden caption must not be translated.\n", [["b"]]],
  ]
  const map = recordMap({ image: {
    type: "image",
    properties: { source: [["https://example.com/image.png"]], caption },
    format: { display_source: "https://example.com/image.png" },
  } })
  const original = article(map)
  freeze(original)
  const plan = createTranslationPlan(original, "en")
  expect(plan.texts).toEqual(["Article title", "Article summary."])
  const next = plan.apply(translated(plan)).recordMap!
  expect(next.block.image).toBe(map.block.image)
  expect(properties(next, "image").caption).toBe(caption)
  expect((properties(next, "image").caption as unknown[][])[0][0]).toBe(href)
  expect(properties(next, "image").caption).toEqual([
    [href, [["a", "https://example.com/annotation-target"]], { retained: true }],
    ["  This hidden caption must not be translated.\n", [["b"]]],
  ])
})

it("keeps plain localized dates as prose while guarding actual date decorations", () => {
  const dateMention = ["2026년 10월 16일", [["d", { start_date: "2026-10-16" }]]]
  const map = recordMap({ body: { properties: { title: [["2026년 10월 16일"], dateMention] } } })
  const plan = createTranslationPlan(article(map), "ko")
  expect(plan.texts).toEqual(["Article title", "Article summary.", "2026년 10월 16일"])
  const next = properties(plan.apply(new Map([[2, "October 16, 2026"]])).recordMap!, "body").title as unknown[][]
  expect(next[0]).toEqual(["October 16, 2026"])
  expect(next[1]).toBe(dateMention)
})

it("preserves code/math/mention tokens, link destinations, annotation arrays, and tuple extras", () => {
  const annotations = [["b"], ["i"], ["_"], ["h", "red"], ["a", "https://example.com/target"]]
  const title = [
    ["Linked label", annotations, { retained: true }],
    ["inline code", [["c"]]],
    ["inline math", [["e", "x^2"]]],
    ["Page mention", [["p", "another-page"]]],
    ["Person mention", [["u", "person-id"]]],
    ["Date mention", [["d", { start_date: "2026-10-16" }]]],
    ["Linked mention", [["lm", "https://example.com"]]],
    ["External mention", [["‣", ["p", "another-page"]]]],
    ["Object mention", [["eoi", "object-id"]]],
    ["‣"], ["⁍"], [" \t— ... !? \n"],
    ["Commented prose", [["m", "discussion-id"]]],
  ]
  const map = recordMap({ body: { properties: { title } } })
  const plan = createTranslationPlan(article(map), "en")
  expect(plan.texts).toEqual(["Article title", "Article summary.", "Linked label", "Commented prose"])
  const next = properties(plan.apply(translated(plan)).recordMap!, "body").title as unknown[][]
  expect(next[0][0]).toBe("Translated Linked label")
  expect(next[0][1]).toBe(annotations)
  expect(next[0][2]).toBe(title[0][2])
  for (let index = 1; index < 12; index++) expect(next[index]).toBe(title[index])
  expect(next[12][0]).toBe("Translated Commented prose")
  expect(next[12][1]).toBe(title[12][1])
})

it("excludes URLs both alone and within prose before sentence splitting", () => {
  const map = recordMap({ body: { properties: { title: [
    ["Read https://host.example/path?q=1#part for details.\nVisit www.example.com/docs now."],
    [" https://example.com/path \t"], ["/article-slug"], ["#heading"], ["?query=value"],
    ["Email mailto:hello@example.com today."],
  ] } } })
  const original = article(map)
  const plan = createTranslationPlan(original, "en")
  expect(plan.texts).toEqual([
    "Article title", "Article summary.", "Read", "for details.", "Visit", "now.", "Email", "today.",
  ])
  const result = properties(plan.apply(translated(plan)).recordMap!, "body").title as string[][]
  expect(result[0][0]).toBe("Translated Read https://host.example/path?q=1#part Translated for details.\nTranslated Visit www.example.com/docs Translated now.")
  expect(result[1]).toBe((properties(map, "body").title as unknown[])[1])
  expect(result[2][0]).toBe("/article-slug")
  expect(result[5][0]).toBe("Translated Email mailto:hello@example.com Translated today.")
  expect(plan.apply(new Map())).toBe(original)
})

it("protects conservative bare-domain and IP URL tokens in prose, including surrounding punctuation", () => {
  const map = recordMap({ body: { properties: { title: [
    ["Visit example.com/docs?lang=en#guide for details.\nUse 192.168.1.10:8080/status today."],
    ["Read (example.org/guide) now."],
  ] } } })
  const plan = createTranslationPlan(article(map), "en")
  expect(plan.texts).toEqual([
    "Article title", "Article summary.", "Visit", "for details.", "Use", "today.", "Read (", ") now.",
  ])
  const translations = translated(plan)
  translations.set(6, "See (")
  translations.set(7, ") today.")
  const next = properties(plan.apply(translations).recordMap!, "body").title as string[][]
  expect(next[0][0]).toBe("Translated Visit example.com/docs?lang=en#guide Translated for details.\nTranslated Use 192.168.1.10:8080/status Translated today.")
  expect(next[1][0]).toBe("See (example.org/guide) today.")
})

it.each([
  "$E = mc^2$",
  "$$\\frac{a}{b} + x_1$$",
  "\\(\\alpha + \\beta\\)",
  "\\[\\sum_{i=1}^{n} i\\]",
])("excludes raw math %s from requests while translating surrounding metadata and prose", expression => {
  const annotations = [["b"], ["a", "https://example.com/formula"]]
  const original: TranslationArticle = {
    title: `  Energy ${expression} explained.  `,
    summary: `\nMore ${expression}\tideas.\r\n`,
    recordMap: recordMap({ body: { properties: { title: [[` \tBefore ${expression} after.\nNext ${expression} end.  `, annotations]] } } }),
  }
  const plan = createTranslationPlan(original, "en")
  expect(plan.texts).toEqual([
    "Energy", "explained.", "More", "ideas.", "Before", "after.", "Next", "end.",
  ])
  const next = plan.apply(translated(plan))
  expect(next.title).toBe(`  Translated Energy ${expression} Translated explained.  `)
  expect(next.summary).toBe(`\nTranslated More ${expression}\tTranslated ideas.\r\n`)
  expect(properties(next.recordMap!, "body").title).toEqual([
    [` \tTranslated Before ${expression} Translated after.\nTranslated Next ${expression} Translated end.  `, annotations],
  ])
  expect(plan.apply(new Map())).toBe(original)
})

it("follows article descendants in content order and arbitrary table column IDs in visual order", () => {
  const map = recordMap({
    unrelated: { properties: { title: [["Unrelated prose"]] } },
    row: { type: "table_row", properties: { "2": [["Second cell"]], "arbitrary:column": [["First cell"]], "third/column": [["Third cell"]] } },
    table: { type: "table", content: ["row"], format: { table_block_column_order: ["arbitrary:column", "2", "third/column"] } },
    column: { type: "column", content: ["toggle"] },
    columns: { type: "column_list", content: ["column"] },
    toggle: { type: "toggle", properties: { title: [["Toggle title"]] }, content: ["table"] },
  }, ["columns"])
  const plan = createTranslationPlan(article(map), "en")
  expect(plan.texts).toEqual(["Article title", "Article summary.", "Toggle title", "First cell", "Second cell", "Third cell"])
  const next = plan.apply(translated(plan)).recordMap!
  expect(properties(next, "row")).toEqual({
    "2": [["Translated Second cell"]], "arbitrary:column": [["Translated First cell"]], "third/column": [["Translated Third cell"]],
  })
  expect(next.block.unrelated).toBe(map.block.unrelated)
  expect(next.block.columns).toBe(map.block.columns)
  expect(next.block.table).toBe(map.block.table)
  expect(unwrapBlock(next.block.table)?.content).toBe(unwrapBlock(map.block.table)?.content)
})

it("does not traverse unrelated child pages, databases, mention targets or disconnected trees", () => {
  const map = recordMap({
    body: { properties: { title: [["Article prose"], ["Mention", [["p", "foreign"]]]] }, content: ["body", "missing"] },
    page: { type: "page", properties: { title: [["Child page"]] }, content: ["foreign"] },
    database: { type: "collection_view", content: ["foreign"] },
    foreign: { properties: { title: [["Foreign prose"]] } },
    disconnected: { properties: { title: [["Disconnected prose"]] } },
  }, ["body", "page", "database"])
  const plan = createTranslationPlan(article(map), "en")
  expect(plan.texts).toEqual(["Article title", "Article summary.", "Article prose"])
  const next = plan.apply(translated(plan)).recordMap!
  for (const id of [ROOT, "page", "database", "foreign", "disconnected"]) expect(next.block[id]).toBe(map.block[id])
  expect(unwrapBlock(next.block.body)?.id).toBe("body")
  expect(unwrapBlock(next.block.body)?.content).toEqual(["body", "missing"])
})

it.each([1, 2, 4])("copies only changed envelope paths without mutating frozen input (depth=%s)", depth => {
  const annotations = [["b"]]
  const map = recordMap({ body: { properties: { title: [["Body text", annotations]], caption: [["Caption text"]], untouched: [["Metadata"]] } } })
  let envelope: unknown = map.block.body
  for (let index = 1; index < depth; index++) envelope = { role: "reader", value: envelope, retained: { index } }
  map.block.body = envelope as ExtendedRecordMap["block"][string]
  const original = article(map)
  freeze(original)
  const plan = createTranslationPlan(original, "en")
  const next = plan.apply(new Map([[2, "Translated body"]]))
  expect(next.recordMap).not.toBe(map)
  expect(next.recordMap!.block).not.toBe(map.block)
  expect(next.recordMap!.block[ROOT]).toBe(map.block[ROOT])
  expect(next.recordMap!.collection).toBe(map.collection)
  expect(next.recordMap!.signed_urls).toBe(map.signed_urls)
  let oldEnvelope: unknown = map.block.body
  let nextEnvelope: unknown = next.recordMap!.block.body
  for (let index = 0; index < depth; index++) {
    const oldBox = oldEnvelope as { value: unknown; role: string; retained?: unknown }
    const nextBox = nextEnvelope as typeof oldBox
    expect(nextBox).not.toBe(oldBox)
    expect(nextBox.role).toBe(oldBox.role)
    expect(nextBox.retained).toBe(oldBox.retained)
    oldEnvelope = oldBox.value
    nextEnvelope = nextBox.value
  }
  const oldBlock = oldEnvelope as Block
  const nextBlock = nextEnvelope as Block
  expect(nextBlock.id).toBe(oldBlock.id)
  expect(nextBlock.properties).not.toBe(oldBlock.properties)
  const oldProperties = oldBlock.properties as Record<string, unknown>
  const nextProperties = nextBlock.properties as Record<string, unknown>
  expect(nextProperties.title).toEqual([["Translated body", annotations]])
  expect((nextProperties.title as unknown[][])[0][1]).toBe(annotations)
  expect(nextProperties.caption).toBe(oldProperties.caption)
  expect(nextProperties.untouched).toBe(oldProperties.untouched)
  expect(oldProperties.title).toEqual([["Body text", annotations]])
})

it("applies partial results independently and restores original values for missing or blank results", () => {
  const original = article(recordMap({ body: { properties: { title: [["Body sentence. Another sentence."]] } } }))
  const plan = createTranslationPlan(original, "en")
  const complete = plan.apply(translated(plan))
  expect(complete.title).toBe("Translated Article title")
  const partial = plan.apply(new Map([[3, "Only second sentence."]]))
  expect(partial.title).toBe(original.title)
  expect(partial.summary).toBe(original.summary)
  expect(properties(partial.recordMap!, "body").title).toEqual([["Body sentence. Only second sentence."]])
  expect(plan.apply(new Map())).toBe(original)
  expect(plan.apply(new Map([[0, ""], [1, " \t\n"], [2, ""], [999, "Unknown result"]]))).toBe(original)
  expect(plan.apply(new Map(plan.texts.map((text, index) => [index, text])))).toBe(original)
  expect(properties(original.recordMap!, "body").title).toEqual([["Body sentence. Another sentence."]])
  expect(properties(complete.recordMap!, "body").title).toEqual([["Translated Body sentence. Translated Another sentence."]])
})

it("keeps unchanged map identity for metadata-only changes and handles empty articles", () => {
  const original = article(recordMap({ body: { properties: { title: [["Body text"]] } } }))
  const result = createTranslationPlan(original, "en").apply(new Map([[0, "New title"]]))
  expect(result.title).toBe("New title")
  expect(result.recordMap).toBe(original.recordMap)
  const empty = { title: " \t", summary: "... —\n", recordMap: recordMap({}, []) }
  const plan = createTranslationPlan(empty, "ko-KR")
  expect(plan.texts).toEqual([])
  expect(plan.apply(new Map())).toBe(empty)
})

it("matches dashed and undashed content IDs without changing block/navigation identifiers", () => {
  const id = "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb"
  const map = recordMap({ [id]: { properties: { title: [["Navigable text"]] } } }, [id.replace(/-/g, "").toUpperCase()])
  const plan = createTranslationPlan(article(map), "en")
  expect(plan.texts[2]).toBe("Navigable text")
  const next = plan.apply(new Map([[2, "Translated navigation text"]])).recordMap!
  expect(Object.keys(next.block)).toEqual(Object.keys(map.block))
  expect(unwrapBlock(next.block[id])?.id).toBe(id)
  expect(unwrapBlock(next.block[ROOT])?.content).toBe(unwrapBlock(map.block[ROOT])?.content)
})

it("translates rendered synced blocks outside root content once and terminates reference cycles", () => {
  const map = recordMap({
    reference: { type: "transclusion_reference", format: { transclusion_reference_pointer: { id: "synced" } } },
    repeated: { type: "transclusion_reference", format: { transclusion_reference_pointer: { id: "synced" } } },
    synced: { type: "transclusion_container", content: ["synced-prose", "cycle"] },
    "synced-prose": { properties: { title: [["동기화된 본문입니다."]] } },
    cycle: { type: "transclusion_reference", format: { transclusion_reference_pointer: { id: "synced" } } },
    unrelated: { properties: { title: [["Unrelated text"]] } },
  }, ["reference", "repeated"])
  const plan = createTranslationPlan(article(map), "ko")
  expect(plan.texts).toEqual(["Article title", "Article summary.", "동기화된 본문입니다."])
  const result = plan.apply(new Map([[2, "This is synced content."]])).recordMap!
  expect(properties(result, "synced-prose").title).toEqual([["This is synced content."]])
  expect(properties(map, "synced-prose").title).toEqual([["동기화된 본문입니다."]])
  expect(result.block.unrelated).toBe(map.block.unrelated)
})
