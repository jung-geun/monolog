import type { ExtendedRecordMap, Block } from "notion-types"
import type { TPost, TNotionDatabase } from "src/types"
import { renderPostMarkdown, renderPostMarkdownDocument } from "src/libs/utils/notion/markdown"
import { normalizeNotionId } from "src/libs/utils/notion/rewriteInternalLinks"
import { createTranslationPlan } from "src/routes/Detail/PostDetail/articleTranslation"
import { renderTranslatedMarkdownDocument } from "src/routes/Detail/PostDetail/translatedMarkdown"

describe("normalizeNotionId", () => {
  it("normalizes UUID dashes and converts to lowercase", () => {
    const raw = "12345678-9ABC-DEF0-1234-56789ABCDEF0"
    expect(normalizeNotionId(raw)).toBe("123456789abcdef0123456789abcdef0")
  })
})

describe("renderPostMarkdown", () => {
  const basePost: TPost = {
    id: "root-post-id",
    title: "Test Post Title",
    slug: "test-post",
    date: { start_date: "2026-08-11" },
    createdTime: "2026-08-11T00:00:00.000Z",
    lastEditedTime: "2026-08-11T12:00:00.000Z",
    type: ["Post"],
    tags: ["tech", "testing"],
    category: ["Engineering"],
    series: ["Notion MD"],
    summary: "This is a summary paragraph.",
    author: [{ id: "author-1", name: "Alice" }, { id: "author-2", name: "Bob" }],
    status: ["Public"],
    fullWidth: false,
  }

  const allPosts: TPost[] = [
    basePost,
    {
      id: "linked-page-id",
      title: "Linked Page",
      slug: "linked-page",
      date: { start_date: "2026-08-10" },
      createdTime: "2026-08-10T00:00:00.000Z",
      type: ["Page"],
      status: ["Public"],
      fullWidth: false,
    },
  ]

  function makeRecordMap(
    blocks: Record<string, Record<string, unknown>>
  ): ExtendedRecordMap {
    const recordMapBlock: ExtendedRecordMap["block"] = {}
    for (const [id, value] of Object.entries(blocks)) {
      recordMapBlock[id] = {
        role: "editor",
        value: {
          id,
          version: 1,
          type: "text",
          ...value,
        } as unknown as Block,
      }
    }
    return {
      block: recordMapBlock,
      collection: {},
      collection_view: {},
      notion_user: {},
      collection_query: {},
      signed_urls: {},
    }
  }

  it("omits empty optional frontmatter fields", () => {
    const sparsePost: TPost = {
      id: "root-post-id",
      title: "Minimal Post",
      slug: "minimal-post",
      date: { start_date: "2026-08-11" },
      createdTime: "2026-08-11T00:00:00.000Z",
      type: ["Post"],
      status: ["Public"],
      fullWidth: false,
    }

    const recordMap = makeRecordMap({
      "root-post-id": {
        id: "root-post-id",
        type: "page",
        content: [],
      },
    })

    const markdown = renderPostMarkdown(sparsePost, recordMap, new Map(), {
      siteUrl: "https://example.com",
      allPosts: [sparsePost],
    })

    expect(markdown).not.toContain("description:")
    expect(markdown).not.toContain("last_modified:")
    expect(markdown).not.toContain("tags:")
    expect(markdown).not.toContain("categories:")
    expect(markdown).not.toContain("series:")
    expect(markdown).not.toContain("authors:")
  })

  it("renders H1 title and shifted headings (##, ###, ####)", () => {
    const recordMap = makeRecordMap({
      "root-post-id": {
        id: "root-post-id",
        type: "page",
        content: ["h2-id", "h3-id", "h4-id"],
      },
      "h2-id": {
        id: "h2-id",
        type: "header",
        properties: { title: [["Header 2"]] },
      },
      "h3-id": {
        id: "h3-id",
        type: "sub_header",
        properties: { title: [["Header 3"]] },
      },
      "h4-id": {
        id: "h4-id",
        type: "sub_sub_header",
        properties: { title: [["Header 4"]] },
      },
    })

    const markdown = renderPostMarkdown(basePost, recordMap, new Map(), {
      siteUrl: "https://example.com",
      allPosts,
    })

    expect(markdown).toContain("## Header 2")
    expect(markdown).toContain("### Header 3")
    expect(markdown).toContain("#### Header 4")
  })

  it("promotes the highest used heading to ## and never skips a level", () => {
    const recordMap = makeRecordMap({
      "root-post-id": {
        id: "root-post-id",
        type: "page",
        content: ["lead-id", "top-id", "deep-id"],
      },
      "lead-id": { id: "lead-id", type: "header_4", properties: { title: [["Lead"]] } },
      "top-id": { id: "top-id", type: "sub_header", properties: { title: [["Top"]] } },
      "deep-id": { id: "deep-id", type: "header_4", properties: { title: [["Deep"]] } },
    })

    const markdown = renderPostMarkdown(basePost, recordMap, new Map(), {
      siteUrl: "https://example.com",
      allPosts,
    })

    expect(markdown).toContain("## Lead\n\n## Top\n\n### Deep")
  })

  it("derives description from the first prose block when Summary is empty", () => {
    const recordMap = makeRecordMap({
      "root-post-id": {
        id: "root-post-id",
        type: "page",
        content: ["heading-id", "code-id", "prose-id"],
      },
      "heading-id": { id: "heading-id", type: "header", properties: { title: [["Not this"]] } },
      "code-id": { id: "code-id", type: "code", properties: { title: [["const no = 1"]] } },
      "prose-id": { id: "prose-id", type: "text", properties: { title: [["First real ‣ sentence."]] } },
    })

    const markdown = renderPostMarkdown({ ...basePost, summary: " " }, recordMap, new Map(), {
      siteUrl: "https://example.com",
      allPosts,
    })

    expect(markdown).toContain('description: "First real sentence."')
  })

  it("renders combined bold, italic, link, inline code, and equation decorations", () => {
    const recordMap = makeRecordMap({
      "root-post-id": {
        id: "root-post-id",
        type: "page",
        content: ["text-id"],
      },
      "text-id": {
        id: "text-id",
        type: "text",
        properties: {
          title: [
            [
              "styled text",
              [
                ["b"],
                ["i"],
                ["c"],
                ["a", "https://example.com/target"],
              ],
            ],
            [" and "],
            ["x^2", [["e"]]],
          ],
        },
      },
    })

    const markdown = renderPostMarkdown(basePost, recordMap, new Map(), {
      siteUrl: "https://example.com",
      allPosts,
    })

    // Code (`styled text`) inside bold/italic (***...***) inside link ([...](url))
    expect(markdown).toContain("[***`styled text`***](https://example.com/target) and $x^2$")
  })

  it("renders equation segment with bold, italic, and link decorations", () => {
    const recordMap = makeRecordMap({
      "root-post-id": {
        id: "root-post-id",
        type: "page",
        content: ["text-id"],
      },
      "text-id": {
        id: "text-id",
        type: "text",
        properties: {
          title: [
            [
              "e",
              [
                ["e", "expression"],
                ["b"],
                ["i"],
                ["a", "https://example.test/e"],
              ],
            ],
            [" and "],
            [
              "e",
              [
                ["e", "unsafe_expr"],
                ["b"],
                ["a", "javascript:alert(1)"],
              ],
            ],
          ],
        },
      },
    })

    const markdown = renderPostMarkdown(basePost, recordMap, new Map(), {
      siteUrl: "https://example.com",
      allPosts,
    })

    expect(markdown).toContain("[***$expression$***](https://example.test/e)")
    expect(markdown).toContain("**$unsafe_expr$**")
    expect(markdown).not.toContain("javascript:alert(1)")
  })

  it("handles normalized page mentions (p decoration mapped to slug)", () => {
    const recordMap = makeRecordMap({
      "root-post-id": {
        id: "root-post-id",
        type: "page",
        content: ["text-id", "page-block-id"],
      },
      "text-id": {
        id: "text-id",
        type: "text",
        properties: {
          title: [["Mention ", []], ["Linked Page", [["p", "linked-page-id"]]]],
        },
      },
      "page-block-id": {
        id: "linked-page-id",
        type: "page",
        properties: { title: [["Linked Page Title"]] },
      },
    })

    const markdown = renderPostMarkdown(basePost, recordMap, new Map(), {
      siteUrl: "https://example.com",
      allPosts,
    })

    expect(markdown).toContain("Mention [Linked Page](https://example.com/linked-page)")
    expect(markdown).toContain("- [Linked Page Title](https://example.com/linked-page)")
  })

  it("falls back to plain text for unsafe link destinations", () => {
    const recordMap = makeRecordMap({
      "root-post-id": {
        id: "root-post-id",
        type: "page",
        content: ["unsafe-id"],
      },
      "unsafe-id": {
        id: "unsafe-id",
        type: "text",
        properties: {
          title: [["Click me", [["a", "javascript:alert(1)"]]]],
        },
      },
    })

    const markdown = renderPostMarkdown(basePost, recordMap, new Map(), {
      siteUrl: "https://example.com",
      allPosts,
    })

    expect(markdown).toContain("Click me")
    expect(markdown).not.toContain("javascript:alert")
    expect(markdown).not.toContain("[Click me]")
  })

  it("renders nested bullet, number, todo, toggle, quote, and column blocks", () => {
    const recordMap = makeRecordMap({
      "root-post-id": {
        id: "root-post-id",
        type: "page",
        content: ["bullet-1", "num-1", "todo-1", "toggle-1", "quote-1", "col-list"],
      },
      "bullet-1": {
        id: "bullet-1",
        type: "bulleted_list",
        properties: { title: [["Bullet 1"]] },
        content: ["bullet-child"],
      },
      "bullet-child": {
        id: "bullet-child",
        type: "bulleted_list",
        properties: { title: [["Nested Bullet"]] },
      },
      "num-1": {
        id: "num-1",
        type: "numbered_list",
        properties: { title: [["Number 1"]] },
      },
      "todo-1": {
        id: "todo-1",
        type: "to_do",
        properties: { title: [["Task Done"]], checked: [["Yes"]] },
      },
      "toggle-1": {
        id: "toggle-1",
        type: "toggle",
        properties: { title: [["Toggle Header"]] },
        content: ["toggle-child"],
      },
      "toggle-child": {
        id: "toggle-child",
        type: "text",
        properties: { title: [["Inside Toggle"]] },
      },
      "quote-1": {
        id: "quote-1",
        type: "quote",
        properties: { title: [["First Quote Line"]] },
        content: ["quote-child"],
      },
      "quote-child": {
        id: "quote-child",
        type: "text",
        properties: { title: [["Second Quote Line"]] },
      },
      "col-list": {
        id: "col-list",
        type: "column_list",
        content: ["col-1", "col-2"],
      },
      "col-1": {
        id: "col-1",
        type: "column",
        content: ["col-1-text"],
      },
      "col-1-text": {
        id: "col-1-text",
        type: "text",
        properties: { title: [["Column 1 Text"]] },
      },
      "col-2": {
        id: "col-2",
        type: "column",
        content: ["col-2-text"],
      },
      "col-2-text": {
        id: "col-2-text",
        type: "text",
        properties: { title: [["Column 2 Text"]] },
      },
    })

    const markdown = renderPostMarkdown(basePost, recordMap, new Map(), {
      siteUrl: "https://example.com",
      allPosts,
    })

    expect(markdown).toContain("- Bullet 1\n  - Nested Bullet")
    expect(markdown).toContain("1. Number 1")
    expect(markdown).toContain("- [x] Task Done")
    expect(markdown).toContain("- **Toggle Header**\n  Inside Toggle")
    expect(markdown).toContain("> First Quote Line\n> \n> Second Quote Line")
    expect(markdown).toContain("Column 1 Text")
    expect(markdown).toContain("Column 2 Text")
  })

  it("handles code blocks containing triple backticks and validates language tags", () => {
    const recordMap = makeRecordMap({
      "root-post-id": {
        id: "root-post-id",
        type: "page",
        content: ["code-1", "code-2"],
      },
      "code-1": {
        id: "code-1",
        type: "code",
        properties: {
          title: [["const x = ```hello```;"]],
          language: [["typescript"]],
          caption: [["Code caption"]],
        },
      },
      "code-2": {
        id: "code-2",
        type: "code",
        properties: {
          title: [["plain text code"]],
          language: [["plain text"]],
        },
      },
    })

    const markdown = renderPostMarkdown(basePost, recordMap, new Map(), {
      siteUrl: "https://example.com",
      allPosts,
    })

    // Fence longer than 3 backticks when content has ```
    expect(markdown).toContain("````typescript\nconst x = ```hello```;\n````")
    expect(markdown).toContain("*Code caption*")
    expect(markdown).toContain("```\nplain text code\n```")
  })

  it("renders images with stable proxied URLs and fallback captions", () => {
    const recordMap = makeRecordMap({
      "root-post-id": {
        id: "root-post-id",
        type: "page",
        content: ["img-1", "img-2"],
      },
      "img-1": {
        id: "img-1",
        type: "image",
        properties: {
          source: [["https://images.unsplash.com/photo-123"]],
          caption: [["Unsplash photo"]],
        },
      },
      "img-2": {
        id: "img-2",
        type: "image",
        properties: {
          caption: [["Missing source caption"]],
        },
      },
    })

    const markdown = renderPostMarkdown(basePost, recordMap, new Map(), {
      siteUrl: "https://example.com",
      allPosts,
    })

    expect(markdown).toContain("![Unsplash photo](https://images.unsplash.com/photo-123)")
    expect(markdown).toContain("Missing source caption")
  })

  it("renders canonical Notion tables with header and no-header options and escapes pipes/newlines", () => {
    const recordMap = makeRecordMap({
      "root-post-id": {
        id: "root-post-id",
        type: "page",
        content: ["table-header", "table-no-header"],
      },
      "table-header": {
        id: "table-header",
        type: "table",
        format: { table_block_column_header: true, table_block_column_order: ["cell_0", "cell_1"] },
        content: ["row-1", "row-2"],
      },
      "row-1": {
        id: "row-1",
        type: "table_row",
        properties: {
          cell_0: [["Header 1"]], cell_1: [["Header | 2"]],
        },
      },
      "row-2": {
        id: "row-2",
        type: "table_row",
        properties: {
          cell_0: [["Val 1"]], cell_1: [["Val\n2"]],
        },
      },
      "table-no-header": {
        id: "table-no-header",
        type: "table",
        format: { table_block_column_header: false, table_block_row_header: true, table_block_column_order: ["cell_0", "cell_1"] },
        content: ["row-no-hdr"],
      },
      "row-no-hdr": {
        id: "row-no-hdr",
        type: "table_row",
        properties: {
          cell_0: [["Cell A"]], cell_1: [["Cell B"]],
        },
      },
    })

    const markdown = renderPostMarkdown(basePost, recordMap, new Map(), {
      siteUrl: "https://example.com",
      allPosts,
    })

    expect(markdown).toContain("| Header 1 | Header \\| 2 |")
    expect(markdown).toContain("| Val 1 | Val<br>2 |")
    expect(markdown).toContain("|  |  |") // synthesized empty header
    expect(markdown).toContain("| Cell A | Cell B |")
  })

  it("uses declared RNX column IDs in order, preserves empty cells and maps every table row", () => {
    const recordMap = makeRecordMap({
      "root-post-id": { type: "page", content: ["table"] },
      table: {
        type: "table",
        format: {
          table_block_column_header: true,
          table_block_column_order: ["name", "detail", "empty", "missing"],
        },
        content: ["header", "row", "emptyrow"],
      },
      header: {
        type: "table_row", parent_id: "table",
        properties: { detail: [["Detail"]], name: [["Name"]], empty: [], unrelated: [["Not a column"]] },
      },
      row: {
        type: "table_row", parent_id: "table",
        properties: {
          detail: [["first\r\nsecond\nthird"]],
          name: [["strong |", [["b"]]], [" ", []], ["x|y", [["c"]]], [" ", []], ["link", [["a", "https://example.com/a|b"]]]],
          empty: [[""]],
        },
      },
      emptyrow: { type: "table_row", parent_id: "table" },
    })
    const options = { siteUrl: "https://example.com", allPosts }
    const document = renderPostMarkdownDocument(basePost, recordMap, new Map(), options)
    const tableLines = [
      "| Name | Detail |  |  |",
      "| --- | --- | --- | --- |",
      "| **strong \\|** `x\\|y` [link](https://example.com/a\\|b) | first<br>second<br>third |  |  |",
      "|  |  |  |  |",
    ]

    expect(document.markdown).toBe(renderPostMarkdown(basePost, recordMap, new Map(), options))
    expect(document.markdown.split("\n").slice(24)).toEqual([...tableLines, ""])
    expect(document.blocks.slice(2)).toEqual([
      { blockId: "table", startLine: 25, endLine: 28 },
      { blockId: "header", startLine: 25, endLine: 25 },
      { blockId: "row", startLine: 27, endLine: 27 },
      { blockId: "emptyrow", startLine: 28, endLine: 28 },
    ])
  })

  it.each([1, 2])("preserves %i literal backslashes before code table pipes without changing other cell escaping", (backslashCount) => {
    const backslashes = "\\".repeat(backslashCount)
    const recordMap = makeRecordMap({
      "root-post-id": { type: "page", content: ["table"] },
      table: {
        type: "table",
        format: { table_block_column_order: ["cell_0", "cell_1", "cell_2"] },
        content: ["row"],
      },
      row: {
        type: "table_row", parent_id: "table",
        properties: {
          cell_0: [[`left${backslashes}|right <x>*`, [["c"]]]],
          cell_1: [["equation", [["e", "a|b"]]]],
          cell_2: [["plain \\| text"]],
        },
      },
    })
    const options = { siteUrl: "https://example.com", allPosts }
    const document = renderPostMarkdownDocument(basePost, recordMap, new Map(), options)

    expect(document.markdown).toBe(renderPostMarkdown(basePost, recordMap, new Map(), options))
    const tableLines = document.markdown.split("\n").slice(24)
    const code = tableLines[2].match(/<code>.*?<\/code>/)?.[0]
    expect(code).toBeDefined()
    const decoded = new DOMParser().parseFromString(code!, "text/html").body
    expect(decoded.querySelector("code")?.textContent).toBe(`left${backslashes}|right <x>*`)
    expect(decoded.querySelector("x")).toBeNull()
    expect(tableLines[2]).toContain(" | $a\\|b$ | plain \\\\\\| text |")
    expect(tableLines[2].match(/(?<!\\)\|/g)).toHaveLength(4)
  })

  it("retains a canonical header-only table even when every declared cell is absent", () => {
    const recordMap = makeRecordMap({
      "root-post-id": { type: "page", content: ["table"] },
      table: {
        type: "table",
        format: { table_block_column_header: true, table_block_column_order: ["cell_0", "cell_1"] },
        content: ["header"],
      },
      header: { type: "table_row", parent_id: "table", properties: {} },
    })
    const options = { siteUrl: "https://example.com", allPosts }
    const document = renderPostMarkdownDocument(basePost, recordMap, new Map(), options)

    expect(document.markdown).toBe(renderPostMarkdown(basePost, recordMap, new Map(), options))
    expect(document.markdown.split("\n").slice(24)).toEqual(["|  |  |", "| --- | --- |", ""])
    expect(document.blocks.slice(2)).toEqual([
      { blockId: "table", startLine: 25, endLine: 26 },
      { blockId: "header", startLine: 25, endLine: 25 },
    ])
  })

  it("renders embedded database values, dates, arrays, and links", () => {
    const dbId = "db-block-id"
    const recordMap = makeRecordMap({
      "root-post-id": {
        id: "root-post-id",
        type: "page",
        content: [dbId],
      },
      [dbId]: {
        id: dbId,
        type: "collection_view_page",
        properties: { title: [["My Embedded DB"]] },
      },
    })

    const databases = new Map<string, TNotionDatabase>([
      [
        dbId,
        {
          id: dbId,
          title: "My Embedded DB",
          properties: [
            { id: "prop-title", name: "Name", type: "title" },
            { id: "prop-tags", name: "Tags", type: "multi_select" },
            { id: "prop-date", name: "Date", type: "date" },
            { id: "prop-done", name: "Done", type: "checkbox" },
            { id: "prop-url", name: "Link", type: "url" },
          ],
          rows: [
            {
              id: "row-1",
              url: "https://notion.so/row-1",
              lastEdited: "2026-08-11",
              values: {
                Name: "Item One",
                Tags: ["Alpha", "Beta"],
                Date: { start: "2026-08-01", end: "2026-08-05" },
                Done: true,
                Link: "https://example.com/item-1",
              },
            },
          ],
          view: "table",
        },
      ],
    ])

    const markdown = renderPostMarkdown(basePost, recordMap, databases, {
      siteUrl: "https://example.com",
      allPosts,
    })

    expect(markdown).toContain("My Embedded DB")
    expect(markdown).toContain("| Name | Tags | Date | Done | Link |")
    expect(markdown).toContain("Alpha, Beta")
    expect(markdown).toContain("2026-08-01 → 2026-08-05")
    expect(markdown).toContain("true")
    expect(markdown).toContain("[https://example.com/item-1](https://example.com/item-1)")
  })

  it("renders unknown block types retaining title and children", () => {
    const recordMap = makeRecordMap({
      "root-post-id": {
        id: "root-post-id",
        type: "page",
        content: ["unknown-id"],
      },
      "unknown-id": {
        id: "unknown-id",
        type: "custom_future_type" as unknown as Block["type"],
        properties: { title: [["Custom Block Title"]] },
        content: ["child-id"],
      },
      "child-id": {
        id: "child-id",
        type: "text",
        properties: { title: [["Child content inside custom block"]] },
      },
    })

    const markdown = renderPostMarkdown(basePost, recordMap, new Map(), {
      siteUrl: "https://example.com",
      allPosts,
    })

    expect(markdown).toContain("Custom Block Title")
    expect(markdown).toContain("Child content inside custom block")
  })

  it("prevents infinite cycles and handles missing block IDs safely", () => {
    const recordMap = makeRecordMap({
      "root-post-id": {
        id: "root-post-id",
        type: "page",
        content: ["block-a", "missing-id", "root-post-id"],
      },
      "block-a": {
        id: "block-a",
        type: "text",
        properties: { title: [["Block A"]] },
        content: ["block-b"],
      },
      "block-b": {
        id: "block-b",
        type: "text",
        properties: { title: [["Block B"]] },
        content: ["block-a"], // cycle back to block-a
      },
    })

    const markdown = renderPostMarkdown(basePost, recordMap, new Map(), {
      siteUrl: "https://example.com",
      allPosts,
    })

    expect(markdown).toContain("Block A")
    expect(markdown).toContain("Block B")

    // Count occurrences of "Block A" to ensure no duplicates from cyclic traversal
    const blockAOccurrences = (markdown.match(/Block A/g) || []).length
    expect(blockAOccurrences).toBe(1)
  })

  it("throws when post root block is absent in non-null record map", () => {
    const recordMap = makeRecordMap({
      "other-id": {
        id: "other-id",
        type: "text",
        properties: { title: [["Other block"]] },
      },
    })

    expect(() =>
      renderPostMarkdown(basePost, recordMap, new Map(), {
        siteUrl: "https://example.com",
        allPosts,
      })
    ).toThrow("Root block not found in recordMap for post id: root-post-id")
  })

  it("renders frontmatter and title for valid root block with empty content", () => {
    const recordMap = makeRecordMap({
      "root-post-id": {
        id: "root-post-id",
        type: "page",
        content: [],
      },
    })

    const markdown = renderPostMarkdown(basePost, recordMap, new Map(), {
      siteUrl: "https://example.com",
      allPosts,
    })

    expect(markdown).toContain('title: "Test Post Title"')
    expect(markdown).toContain("# Test Post Title")
    expect(markdown.endsWith("\n")).toBe(true)
  })

  it("maps duplicate paragraphs, nested lists/callouts, fences and table rows without changing bytes", () => {
    const recordMap = makeRecordMap({
      "root-post-id": { type: "page", content: ["first", "second", "callout", "code", "table", "empty", "tail"] },
      first: { properties: { title: [["Repeat"]] } },
      second: { properties: { title: [["Repeat"]] } },
      callout: { type: "callout", properties: { title: [["Outer"]] }, content: ["list"] },
      list: { type: "bulleted_list", properties: { title: [["Repeat"]] }, content: ["nested"] },
      nested: { type: "bulleted_list", properties: { title: [["Repeat"]] } },
      code: { type: "code", properties: { title: [["alpha\n```\nomega"]], language: [["ts"]], caption: [["Caption"]] } },
      table: { type: "table", format: { table_block_column_header: true, table_block_column_order: ["cell_0"] }, content: ["header", "row"] },
      header: { type: "table_row", properties: { cell_0: [["Name"]] } },
      row: { type: "table_row", properties: { cell_0: [["Repeat\ncell"]] } },
      empty: { type: "column", content: [] },
      tail: { properties: { title: [["tail  \n\n"]] } },
    })
    const options = { siteUrl: "https://example.com", allPosts }
    const plain = renderPostMarkdown(basePost, recordMap, new Map(), options)
    const mapped = renderPostMarkdownDocument(basePost, recordMap, new Map(), options)

    expect(mapped.markdown).toBe(plain)
    expect(mapped.markdown.split("\n").slice(24).join("\n")).toBe([
      "Repeat", "", "Repeat", "", "> Outer", "> ", "> - Repeat", ">   - Repeat", "",
      "````ts", "alpha", "```", "omega", "````", "*Caption*", "",
      "| Name |", "| --- |", "| Repeat<br>cell |", "", "tail", "",
    ].join("\n"))
    expect(mapped.blocks).toEqual([
      { blockId: "title", startLine: 21, endLine: 21 },
      { blockId: "summary", startLine: 23, endLine: 23 },
      { blockId: "first", startLine: 25, endLine: 25 },
      { blockId: "second", startLine: 27, endLine: 27 },
      { blockId: "callout", startLine: 29, endLine: 32 },
      { blockId: "list", startLine: 31, endLine: 32 },
      { blockId: "nested", startLine: 32, endLine: 32 },
      { blockId: "code", startLine: 34, endLine: 39 },
      { blockId: "table", startLine: 41, endLine: 43 },
      { blockId: "header", startLine: 41, endLine: 41 },
      { blockId: "row", startLine: 43, endLine: 43 },
      { blockId: "tail", startLine: 45, endLine: 45 },
    ])
  })

  it("maps multiline synthetic sections, empty children and nested quote prefixes after final trimming", () => {
    const post = { ...basePost, title: "First\nSecond", summary: "Summary\ncontinued" }
    const recordMap = makeRecordMap({
      "root-post-id": { type: "page", content: ["toggle", "blank"] },
      toggle: { type: "toggle", properties: { title: [["Toggle"]] }, content: ["quote", "empty"] },
      quote: { type: "quote", content: ["paragraph"] },
      paragraph: { properties: { title: [["one\n\ntwo  \n"]] } },
      empty: { properties: { title: [[""]] } },
      blank: { properties: { title: [["  \n\n"]] } },
    })
    const options = { siteUrl: "https://example.com", allPosts: [post] }
    const mapped = renderPostMarkdownDocument(post, recordMap, new Map(), options)
    expect(mapped.markdown).toBe(renderPostMarkdown(post, recordMap, new Map(), options))
    const title = mapped.blocks.find(block => block.blockId === "title")!
    expect(mapped.markdown.split("\n").slice(title.startLine - 1, title.endLine)).toEqual(["# First", "Second"])
    const paragraph = mapped.blocks.find(block => block.blockId === "paragraph")!
    expect(mapped.markdown.split("\n").slice(paragraph.startLine - 1, paragraph.endLine)).toEqual([
      "  > one", "  > ", "  > two  ",
    ])
    expect(mapped.blocks.some(block => block.blockId === "empty" || block.blockId === "blank")).toBe(false)
    expect(mapped.markdown.endsWith("  >\n")).toBe(true)
  })

  it("maps database row identities even when their rendered cells are identical", () => {
    const recordMap = makeRecordMap({
      "root-post-id": { type: "page", content: ["database"] },
      database: { type: "collection_view_page", properties: { title: [["Data"]] } },
    })
    const databases = new Map<string, TNotionDatabase>([["database", {
      id: "database", title: "Data", view: "table",
      properties: [{ id: "name", name: "Name", type: "title" }],
      rows: ["row-a", "row-b"].map(id => ({ id, url: "", lastEdited: "", values: { Name: "Same" } })),
    }]])
    const options = { siteUrl: "https://example.com", allPosts }
    const mapped = renderPostMarkdownDocument(basePost, recordMap, databases, options)
    expect(mapped.markdown).toBe(renderPostMarkdown(basePost, recordMap, databases, options))
    expect(mapped.blocks.filter(block => block.blockId.startsWith("row"))).toEqual([
      { blockId: "rowa", startLine: 29, endLine: 29 },
      { blockId: "rowb", startLine: 30, endLine: 30 },
    ])
  })

  it("maps headerless table rows and multiline equations inside a structural column", () => {
    const recordMap = makeRecordMap({
      "root-post-id": { type: "page", content: ["column"] },
      column: { type: "column", content: ["table", "equation"] },
      table: { type: "table", format: { table_block_column_order: ["cell_0"] }, content: ["row"] },
      row: { type: "table_row", properties: { cell_0: [["Cell"]] } },
      equation: { type: "equation", properties: { title: [["a\nb"]] } },
    })
    const options = { siteUrl: "https://example.com", allPosts }
    const document = renderPostMarkdownDocument(basePost, recordMap, new Map(), options)
    expect(document.markdown).toBe(renderPostMarkdown(basePost, recordMap, new Map(), options))
    expect(document.markdown.split("\n").slice(24)).toEqual([
      "|  |", "| --- |", "| Cell |", "", "$$", "a", "b", "$$", "",
    ])
    expect(document.blocks.slice(2)).toEqual([
      { blockId: "column", startLine: 25, endLine: 32 },
      { blockId: "table", startLine: 25, endLine: 27 },
      { blockId: "row", startLine: 27, endLine: 27 },
      { blockId: "equation", startLine: 29, endLine: 32 },
    ])
  })

  it("maps a generated summary separately from its identical source paragraph and omits absent summaries", () => {
    const post = { ...basePost, summary: "" }
    const recordMap = makeRecordMap({
      "root-post-id": { type: "page", content: ["paragraph"] },
      paragraph: { properties: { title: [["Excerpt text"]] } },
    })
    const options = { siteUrl: "https://example.com", allPosts: [post] }
    const document = renderPostMarkdownDocument(post, recordMap, new Map(), options)
    expect(document.markdown).toBe(renderPostMarkdown(post, recordMap, new Map(), options))
    expect(document.blocks).toEqual([
      { blockId: "title", startLine: 21, endLine: 21 },
      { blockId: "summary", startLine: 23, endLine: 23 },
      { blockId: "paragraph", startLine: 25, endLine: 25 },
    ])
    const emptyMap = makeRecordMap({ "root-post-id": { type: "page", content: [] } })
    const empty = renderPostMarkdownDocument(post, emptyMap, new Map(), options)
    expect(empty.markdown).toBe(renderPostMarkdown(post, emptyMap, new Map(), options))
    expect(empty.blocks).toEqual([{ blockId: "title", startLine: 20, endLine: 20 }])
  })
  it("renders the same translated snapshot as Preview while preserving protected content and database rows", () => {
    const recordMap = makeRecordMap({
      "root-post-id": { type: "page", content: ["heading-id", "prose", "code", "equation", "table", "database"] },
      "heading-id": { type: "header", properties: { title: [["Overview"]] } },
      prose: { properties: { title: [
        ["Read this ", [["a", "/linked-page"]]],
        ["literal_*", [["c"]]],
        [" formula ", [["e", "x_1 + y"]]],
        [" https://example.com/a_(b)"],
        ["Linked Page", [["p", "linked-page-id"]]],
      ] } },
      code: { type: "code", properties: { title: [["const url = 'https://example.com/a_(b)'\nconsole.log(`a|b`)"]], language: [["javascript"]] } },
      equation: { type: "equation", properties: { title: [["\\frac{x_1}{y}"]] } },
      table: { type: "table", format: { table_block_column_order: ["name", "code"], table_block_column_header: true }, content: ["table-header", "table-row"] },
      "table-header": { type: "table_row", properties: { name: [["Name"]], code: [["Value"]] } },
      "table-row": { type: "table_row", properties: { name: [["A cell"]], code: [["a\\|b", [["c"]]]] } },
      database: { type: "collection_view_page", properties: { title: [["Data"]] } },
    })
    const databases = new Map<string, TNotionDatabase>([["database", {
      id: "database", title: "Data", view: "table",
      properties: [{ id: "name", name: "Name", type: "title" }],
      rows: [{ id: "database-row", url: "", lastEdited: "", values: { Name: "Untranslated database value" } }],
    }]])
    const options = { siteUrl: "https://example.com", allPosts }
    const original = renderPostMarkdownDocument(basePost, recordMap, databases, options)
    const plan = createTranslationPlan({ title: basePost.title, summary: basePost.summary!, recordMap }, "en")
    const vocabulary = new Map([
      [basePost.title, 'Título: "traducido"'], [basePost.summary!, "Resumen\nsegunda línea"],
      ["Overview", "Descripción"], ["Read this", "Lee esto"], ["Name", "Nombre"],
      ["Value", "Valor"], ["A cell", "Una celda | otra"],
    ])
    const article = plan.apply(new Map(plan.texts.map((text, index) => [index, vocabulary.get(text) ?? text])))
    const document = renderTranslatedMarkdownDocument({ post: basePost, article, databases, ...options })!
    const lines = document.markdown.split("\n")
    const blockText = (id: string) => {
      const span = document.blocks.find(block => block.blockId === id)!
      return lines.slice(span.startLine - 1, span.endLine).join("\n")
    }

    expect(document.markdown).toContain(`title: ${JSON.stringify(article.title)}`)
    expect(document.markdown).toContain(`description: ${JSON.stringify(article.summary)}`)
    expect(blockText("title")).toBe(`# ${article.title}`)
    expect(blockText("summary")).toBe(article.summary)
    expect(blockText("headingid")).toBe("## Descripción")
    expect(blockText("prose")).toContain("[Lee esto ](https://example.com/linked-page)")
    expect(blockText("prose")).toContain("`literal_*`")
    expect(blockText("prose")).toContain("$x_1 + y$")
    expect(blockText("prose")).toContain("https://example.com/a\\_(b)")
    expect(blockText("prose")).toContain("[Linked Page](https://example.com/linked-page)")
    expect(blockText("tableheader")).toBe("| Nombre | Valor |")
    expect(blockText("tablerow")).toContain("| Una celda \\| otra |")
    for (const id of ["code", "equation", "databaserow"]) {
      const span = original.blocks.find(block => block.blockId === id)!
      expect(blockText(id)).toBe(original.markdown.split("\n").slice(span.startLine - 1, span.endLine).join("\n"))
    }
    expect(blockText("tablerow")).toContain("<code>a&#92;&#124;b</code>")
    expect(document.blocks.map(block => block.blockId)).toEqual(original.blocks.map(block => block.blockId))
    expect(document.markdown).toContain('canonical_url: "https://example.com/test-post"')
    expect(document.markdown).toContain('markdown_url: "https://example.com/test-post.md"')
    expect(renderPostMarkdownDocument(basePost, recordMap, databases, options)).toEqual(original)
    expect(renderPostMarkdown(basePost, recordMap, databases, options)).toBe(original.markdown)
  })

  it("returns no display projection until its actual article root is available", () => {
    const article = { title: "Translated title", summary: "Translated summary", recordMap: null }
    expect(renderTranslatedMarkdownDocument({ post: basePost, article, allPosts })).toBeNull()
    expect(renderTranslatedMarkdownDocument({ post: undefined, article, allPosts })).toBeNull()
    expect(renderTranslatedMarkdownDocument({ post: basePost, article: { ...article, recordMap: makeRecordMap({}) }, allPosts })).toBeNull()
  })
})
