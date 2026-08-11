import type { ExtendedRecordMap, Block } from "notion-types"
import type { TPost, TNotionDatabase } from "src/types"
import { renderPostMarkdown } from "src/libs/utils/notion/markdown"
import { normalizeNotionId } from "src/libs/utils/notion/rewriteInternalLinks"

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

  it("produces exact frontmatter fields, order, and trailing newline", () => {
    const recordMap = makeRecordMap({
      "root-post-id": {
        id: "root-post-id",
        type: "page",
        content: [],
      },
    })
    const databases = new Map<string, TNotionDatabase>()

    const markdown = renderPostMarkdown(basePost, recordMap, databases, {
      siteUrl: "https://example.com/",
      allPosts,
    })

    expect(markdown.endsWith("\n")).toBe(true)

    const expectedFrontmatter = [
      "---",
      'title: "Test Post Title"',
      'description: "This is a summary paragraph."',
      'date: "2026-08-11"',
      'last_modified: "2026-08-11T12:00:00.000Z"',
      'type: "Post"',
      "tags:",
      '  - "tech"',
      '  - "testing"',
      "categories:",
      '  - "Engineering"',
      "series:",
      '  - "Notion MD"',
      "authors:",
      '  - "Alice"',
      '  - "Bob"',
      'canonical_url: "https://example.com/test-post"',
      'markdown_url: "https://example.com/test-post.md"',
      "---",
    ].join("\n")

    expect(markdown).toContain(expectedFrontmatter)
    expect(markdown).toContain("# Test Post Title\n\nThis is a summary paragraph.")
  })

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

  it("renders Notion tables with header and no-header options and escapes pipes/newlines", () => {
    const recordMap = makeRecordMap({
      "root-post-id": {
        id: "root-post-id",
        type: "page",
        content: ["table-header", "table-no-header"],
      },
      "table-header": {
        id: "table-header",
        type: "table",
        format: { table_block_column_header: true },
        content: ["row-1", "row-2"],
      },
      "row-1": {
        id: "row-1",
        type: "table_row",
        properties: {
          table_row: [[["Header 1"]], [["Header | 2"]]],
        },
      },
      "row-2": {
        id: "row-2",
        type: "table_row",
        properties: {
          table_row: [[["Val 1"]], [["Val\n2"]]],
        },
      },
      "table-no-header": {
        id: "table-no-header",
        type: "table",
        format: { table_block_column_header: false },
        content: ["row-no-hdr"],
      },
      "row-no-hdr": {
        id: "row-no-hdr",
        type: "table_row",
        properties: {
          table_row: [[["Cell A"]], [["Cell B"]]],
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
})
