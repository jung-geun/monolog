/**
 * @jest-environment node
 */

import { ExtendedRecordMap } from "notion-types"
import { TNotionDatabase } from "src/types"

const mockRetrieve = jest.fn()

jest.mock("src/apis/notion-client/notionClient", () => ({
  getOfficialNotionClient: () => ({
    databases: {
      retrieve: mockRetrieve,
    },
  }),
}))

jest.mock("src/apis/notion-client/getDatabase", () => ({
  getDatabase: jest.fn(),
}))

jest.mock("src/libs/utils/logger", () => ({
  debugLog: jest.fn(),
}))

import { getRecordMapDatabases } from "src/apis/notion-client/getRecordMapDatabases"
import { getDatabase } from "src/apis/notion-client/getDatabase"

function createRecordMap(blocks: Record<string, { type: string; format?: Record<string, unknown> }>): ExtendedRecordMap {
  const block: ExtendedRecordMap["block"] = {}
  for (const [id, value] of Object.entries(blocks)) {
    block[id] = { value: { id, ...value } } as unknown as ExtendedRecordMap["block"][string]
  }
  return { block } as ExtendedRecordMap
}

describe("getRecordMapDatabases", () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  test("database-free input returns an empty map without API calls", async () => {
    const recordMap = createRecordMap({
      b1: { type: "page" },
      b2: { type: "text" },
    })

    const result = await getRecordMapDatabases(recordMap)

    expect(result.size).toBe(0)
    expect(mockRetrieve).not.toHaveBeenCalled()
    expect(getDatabase).not.toHaveBeenCalled()
  })

  test("own data-source resolution resolves database directly without fallback", async () => {
    const recordMap = createRecordMap({
      db1: { type: "collection_view_page" },
    })

    const dbMeta = {
      id: "db1",
      data_sources: [{ id: "ds-own-1" }],
      title: [{ plain_text: "Source Database" }],
    }
    mockRetrieve.mockResolvedValueOnce(dbMeta)

    const expectedDb: TNotionDatabase = {
      id: "db1",
      title: "Source Database",
      properties: [],
      rows: [],
      view: "table",
    }
    ;(getDatabase as jest.Mock).mockResolvedValueOnce(expectedDb)

    const result = await getRecordMapDatabases(recordMap)

    expect(result.size).toBe(1)
    expect(result.get("db1")).toEqual(expectedDb)
    expect(getDatabase).toHaveBeenCalledWith("db1", undefined, {
      dbMeta,
      fallbackDataSourceId: undefined,
    })
  })

  test("NFC title matching resolves linked views across NFD/NFC title variations", async () => {
    const recordMap = createRecordMap({
      src1: { type: "collection_view_page" },
      link1: { type: "collection_view_page" },
    })

    const nfcTitle = "테스트".normalize("NFC")
    const nfdTitle = "테스트".normalize("NFD")

    mockRetrieve.mockImplementation(async ({ database_id }: { database_id: string }) => {
      if (database_id === "src1") {
        return {
          id: "src1",
          data_sources: [{ id: "ds-src1" }],
          title: [{ plain_text: nfcTitle }],
        }
      }
      return {
        id: "link1",
        data_sources: [],
        title: [{ plain_text: nfdTitle }],
      }
    })

    ;(getDatabase as jest.Mock).mockImplementation(async (id: string) => ({
      id,
      title: "DB " + id,
      properties: [],
      rows: [],
      view: "table",
    }))

    const result = await getRecordMapDatabases(recordMap)

    expect(result.size).toBe(2)
    expect(getDatabase).toHaveBeenCalledWith(
      "link1",
      undefined,
      expect.objectContaining({
        fallbackDataSourceId: "ds-src1",
      })
    )
  })

  test("exactly-one source fallback is applied when title match fails", async () => {
    const recordMap = createRecordMap({
      src1: { type: "collection_view_page" },
      link1: { type: "collection_view_page" },
    })

    mockRetrieve.mockImplementation(async ({ database_id }: { database_id: string }) => {
      if (database_id === "src1") {
        return {
          id: "src1",
          data_sources: [{ id: "ds-single" }],
          title: [{ plain_text: "Source Title" }],
        }
      }
      return {
        id: "link1",
        data_sources: [],
        title: [{ plain_text: "Renamed Title" }],
      }
    })

    ;(getDatabase as jest.Mock).mockImplementation(async (id: string) => ({
      id,
      title: "DB " + id,
      properties: [],
      rows: [],
      view: "table",
    }))

    const result = await getRecordMapDatabases(recordMap)

    expect(result.size).toBe(2)
    expect(getDatabase).toHaveBeenCalledWith(
      "link1",
      undefined,
      expect.objectContaining({
        fallbackDataSourceId: "ds-single",
      })
    )
  })

  test("ambiguous title resolution picks the last source database", async () => {
    const recordMap = createRecordMap({
      src1: { type: "collection_view_page" },
      src2: { type: "collection_view_page" },
      link1: { type: "collection_view_page" },
    })

    mockRetrieve.mockImplementation(async ({ database_id }: { database_id: string }) => {
      if (database_id === "src1") {
        return {
          id: "src1",
          data_sources: [{ id: "ds-first" }],
          title: [{ plain_text: "Duplicate Title" }],
        }
      }
      if (database_id === "src2") {
        return {
          id: "src2",
          data_sources: [{ id: "ds-second" }],
          title: [{ plain_text: "Duplicate Title" }],
        }
      }
      return {
        id: "link1",
        data_sources: [],
        title: [{ plain_text: "Duplicate Title" }],
      }
    })

    ;(getDatabase as jest.Mock).mockImplementation(async (id: string) => ({
      id,
      title: "DB " + id,
      properties: [],
      rows: [],
      view: "table",
    }))

    const result = await getRecordMapDatabases(recordMap)

    expect(result.size).toBe(3)
    expect(getDatabase).toHaveBeenCalledWith(
      "link1",
      undefined,
      expect.objectContaining({
        fallbackDataSourceId: "ds-second",
      })
    )
  })

  test("metadata retrieve failure continues with null metadata", async () => {
    const recordMap = createRecordMap({
      fail1: { type: "collection_view_page" },
    })

    mockRetrieve.mockRejectedValueOnce(new Error("API rate limit"))

    const expectedDb: TNotionDatabase = {
      id: "fail1",
      title: "Fail DB",
      properties: [],
      rows: [],
      view: "table",
    }
    ;(getDatabase as jest.Mock).mockResolvedValueOnce(expectedDb)

    const result = await getRecordMapDatabases(recordMap)

    expect(result.size).toBe(1)
    expect(getDatabase).toHaveBeenCalledWith("fail1", undefined, {
      dbMeta: null,
      fallbackDataSourceId: undefined,
    })
  })

  test("getDatabase failures and null results are omitted from the returned map", async () => {
    const recordMap = createRecordMap({
      ok1: { type: "collection_view_page" },
      err1: { type: "collection_view_page" },
      null1: { type: "collection_view_page" },
    })

    mockRetrieve.mockImplementation(async ({ database_id }: { database_id: string }) => ({
      id: database_id,
      data_sources: [],
      title: [{ plain_text: database_id }],
    }))

    ;(getDatabase as jest.Mock).mockImplementation(async (id: string) => {
      if (id === "ok1") {
        return { id: "ok1", title: "OK DB", properties: [], rows: [], view: "table" }
      }
      if (id === "err1") {
        throw new Error("Failed to load")
      }
      return null
    })

    const result = await getRecordMapDatabases(recordMap)

    expect(result.size).toBe(1)
    expect(result.has("ok1")).toBe(true)
    expect(result.has("err1")).toBe(false)
    expect(result.has("null1")).toBe(false)
  })
})
