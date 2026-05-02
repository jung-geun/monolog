/**
 * @jest-environment node
 */

// Mock cacheStore so tests don't write files
jest.mock("src/libs/cache", () => ({
  cacheStore: {
    get: jest.fn().mockResolvedValue(null),
    set: jest.fn().mockResolvedValue(undefined),
    getOrSet: jest.fn().mockImplementation((_key: string, _ttl: number, fetcher: () => Promise<any>) => fetcher()),
    invalidate: jest.fn(),
    clear: jest.fn(),
  },
  keys: {
    posts: (id: string) => `posts:${id}`,
    recordMap: (id: string, le: string) => `recordMap:${id}:${le}`,
    database: (id: string, le: string) => `database:${id}:${le}`,
  },
}))

jest.mock("src/apis/notion-client/notionClient", () => ({
  getOfficialNotionClient: jest.fn(),
}))

import { getDatabase } from "src/apis/notion-client/getDatabase"
import { getOfficialNotionClient } from "src/apis/notion-client/notionClient"

const defaultDbMeta = {
  last_edited_time: "2026-01-01T00:00:00.000Z",
  title: [{ plain_text: "Test DB" }],
  data_sources: [{ id: "ds-1", name: "default" }],
}

const mockNotion = {
  databases: {
    retrieve: jest.fn().mockResolvedValue(defaultDbMeta),
  },
  dataSources: {
    query: jest.fn(),
    retrieve: jest.fn().mockResolvedValue(null),
  },
}

beforeEach(() => {
  jest.clearAllMocks()
  ;(getOfficialNotionClient as jest.Mock).mockReturnValue(mockNotion)
  mockNotion.databases.retrieve.mockResolvedValue(defaultDbMeta)
  mockNotion.dataSources.retrieve.mockResolvedValue(null)
})

describe("getDatabase", () => {
  it("returns null when databases.retrieve throws", async () => {
    mockNotion.databases.retrieve.mockRejectedValue(new Error("not found"))
    const result = await getDatabase("bad-id")
    expect(result).toBeNull()
  })

  it("returns null when data_sources is empty", async () => {
    mockNotion.databases.retrieve.mockResolvedValue({
      ...defaultDbMeta,
      data_sources: [],
    })
    const result = await getDatabase("no-ds-id")
    expect(result).toBeNull()
  })

  it("returns TNotionDatabase with correct shape", async () => {
    mockNotion.dataSources.query.mockResolvedValue({
      results: [
        {
          id: "row-1",
          last_edited_time: "2026-01-01T00:00:00.000Z",
          properties: {
            Name: {
              type: "title",
              title: [{ plain_text: "Test Post" }],
            },
            Tags: {
              type: "multi_select",
              multi_select: [{ name: "TypeScript" }, { name: "React" }],
            },
          },
        },
      ],
    })

    const db = await getDatabase("db-id")
    expect(db).not.toBeNull()
    expect(db!.rows).toHaveLength(1)
    expect(db!.rows[0].values["Name"]).toBe("Test Post")
    expect(db!.rows[0].values["Tags"]).toEqual(["TypeScript", "React"])
    expect(db!.title).toBe("Test DB")
  })

  it("defaults view to table when no groupable property exists", async () => {
    mockNotion.dataSources.query.mockResolvedValue({
      results: [
        {
          id: "r1",
          last_edited_time: "",
          properties: { Name: { type: "title", title: [{ plain_text: "A" }] } },
        },
      ],
    })
    const db = await getDatabase("id")
    expect(db!.view).toBe("table")
    expect(db!.groupBy).toBeNull()
  })

  it("auto-detects board view when a select property exists", async () => {
    mockNotion.dataSources.query.mockResolvedValue({
      results: [
        {
          id: "r1",
          last_edited_time: "",
          properties: {
            Name: { type: "title", title: [{ plain_text: "Python" }] },
            Tag: { type: "select", select: { name: "주로 사용해요" } },
          },
        },
      ],
    })
    const db = await getDatabase("id")
    expect(db!.view).toBe("board")
    expect(db!.groupBy).toBe("Tag")
  })

  it("prefers status over select for groupBy", async () => {
    mockNotion.dataSources.query.mockResolvedValue({
      results: [
        {
          id: "r1",
          last_edited_time: "",
          properties: {
            Name: { type: "title", title: [{ plain_text: "A" }] },
            Category: { type: "select", select: { name: "x" } },
            State: { type: "status", status: { name: "Done" } },
          },
        },
      ],
    })
    const db = await getDatabase("id")
    expect(db!.groupBy).toBe("State")
  })

  it("extracts page icon (emoji and external)", async () => {
    mockNotion.dataSources.query.mockResolvedValue({
      results: [
        {
          id: "r1",
          last_edited_time: "",
          icon: { type: "emoji", emoji: "🐍" },
          properties: { Name: { type: "title", title: [{ plain_text: "Python" }] } },
        },
        {
          id: "r2",
          last_edited_time: "",
          icon: { type: "external", external: { url: "https://example.com/i.png" } },
          properties: { Name: { type: "title", title: [{ plain_text: "X" }] } },
        },
      ],
    })
    const db = await getDatabase("id")
    expect(db!.rows[0].icon).toEqual({ type: "emoji", emoji: "🐍" })
    expect(db!.rows[1].icon).toEqual({ type: "external", url: "https://example.com/i.png" })
  })

  it("blockFormat view_type overrides auto-detection", async () => {
    mockNotion.dataSources.query.mockResolvedValue({
      results: [
        {
          id: "r1",
          last_edited_time: "",
          properties: {
            Name: { type: "title", title: [{ plain_text: "A" }] },
            Tag: { type: "select", select: { name: "x" } },
          },
        },
      ],
    })
    const db = await getDatabase("id", { view_type: "gallery" })
    expect(db!.view).toBe("gallery")
  })

  it("normalizes empty rows correctly", async () => {
    mockNotion.dataSources.query.mockResolvedValue({ results: [] })
    const db = await getDatabase("empty-db")
    expect(db!.rows).toHaveLength(0)
    expect(db!.properties).toHaveLength(0)
  })

  it("extracts groupOptions order/colors from data source schema", async () => {
    mockNotion.dataSources.retrieve.mockResolvedValue({
      properties: {
        Name: { id: "title", type: "title" },
        Tag: {
          id: "abc",
          type: "select",
          select: {
            options: [
              { id: "1", name: "주로 사용해요", color: "green" },
              { id: "2", name: "사용할 줄 알아요", color: "yellow" },
              { id: "3", name: "보고 이해할 수 있어요", color: "orange" },
            ],
          },
        },
      },
    })
    mockNotion.dataSources.query.mockResolvedValue({
      results: [
        {
          id: "r1",
          last_edited_time: "",
          properties: {
            Name: { type: "title", title: [{ plain_text: "python" }] },
            Tag: { type: "select", select: { name: "주로 사용해요" } },
          },
        },
      ],
    })
    const db = await getDatabase("id")
    expect(db!.groupBy).toBe("Tag")
    expect(db!.groupOptions).toEqual([
      { name: "주로 사용해요", color: "green" },
      { name: "사용할 줄 알아요", color: "yellow" },
      { name: "보고 이해할 수 있어요", color: "orange" },
    ])
  })
})
