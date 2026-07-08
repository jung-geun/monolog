/**
 * @jest-environment node
 */

jest.mock("src/apis/notion-client/notionClient", () => ({
  getOfficialNotionClient: jest.fn(),
}))

import { getOfficialNotionClient } from "src/apis/notion-client/notionClient"
import { trackUniqueVisit } from "src/apis/notion-client/visits"

interface RichTextProperty {
  type: "rich_text"
  rich_text: Array<{ plain_text: string }>
}

interface NumberProperty {
  type: "number"
  number: number | null
}

interface NotionPageStub {
  object: "page"
  id: string
  url: string
  properties: Record<string, RichTextProperty | NumberProperty>
}

interface QueryResponseStub {
  results: NotionPageStub[]
  next_cursor: string | null
}
interface DataSourceQueryArg {
  filter: {
    property: string
    rich_text: { equals: string }
  }
  start_cursor?: string
}

interface Deferred<T> {
  promise: Promise<T>
  resolve: (value: T) => void
  reject: (error: unknown) => void
}

const input = { slug: "hello", postId: "page-1", visitorId: "visitor-1" }

const mockNotion = {
  dataSources: {
    query: jest.fn<Promise<QueryResponseStub>, [unknown]>(),
  },
  pages: {
    create: jest.fn<Promise<unknown>, [unknown]>(),
    retrieve: jest.fn<Promise<NotionPageStub>, [unknown]>(),
    update: jest.fn<Promise<unknown>, [unknown]>(),
  },
}

function visitRow(key: string, id = `row-${key}`): NotionPageStub {
  return {
    object: "page",
    id,
    url: `https://notion.so/${id}`,
    properties: {
      VisitKey: {
        type: "rich_text",
        rich_text: [{ plain_text: key }],
      },
    },
  }
}

function trackedPage(count: number | null): NotionPageStub {
  return {
    object: "page",
    id: "page-1",
    url: "https://notion.so/page-1",
    properties: {
      접속자수: {
        type: "number",
        number: count,
      },
    },
  }
}

function queryResponse(results: NotionPageStub[], nextCursor: string | null = null): QueryResponseStub {
  return {
    results,
    next_cursor: nextCursor,
  }
}

function deferred<T>(): Deferred<T> {
  let resolve!: (value: T) => void
  let reject!: (error: unknown) => void
  const promise = new Promise<T>((res, rej) => {
    resolve = res
    reject = rej
  })

  return { promise, resolve, reject }
}
function captureVisitKeyFromQuery(query: unknown): string {
  const arg = query as DataSourceQueryArg
  return arg.filter.rich_text.equals
}
const schemaFailureCases: Array<{ name: string; page: NotionPageStub }> = [
  {
    name: "the page is missing the 접속자수 property",
    page: {
      object: "page",
      id: "page-1",
      url: "https://notion.so/page-1",
      properties: {},
    },
  },
  {
    name: "the 접속자수 property is not numeric",
    page: {
      object: "page",
      id: "page-1",
      url: "https://notion.so/page-1",
      properties: {
        접속자수: {
          type: "rich_text",
          rich_text: [{ plain_text: "wrong" }],
        },
      },
    },
  },
]

describe("trackUniqueVisit", () => {
  let previousVisitStatsDataSourceId: string | undefined
  let previousVisitorHashSalt: string | undefined

  beforeEach(() => {
    jest.useFakeTimers()
    jest.clearAllMocks()

    previousVisitStatsDataSourceId = process.env.NOTION_VISIT_STATS_DATASOURCE_ID
    previousVisitorHashSalt = process.env.VISITOR_HASH_SALT

    process.env.NOTION_VISIT_STATS_DATASOURCE_ID = "stats-ds"
    process.env.VISITOR_HASH_SALT = "test-salt"

    ;(getOfficialNotionClient as jest.Mock).mockReturnValue(mockNotion)
    mockNotion.pages.create.mockResolvedValue({ id: "created-row" })
    mockNotion.pages.update.mockResolvedValue({ id: "page-1" })
  })

  afterEach(() => {
    jest.runOnlyPendingTimers()
    jest.useRealTimers()

    if (previousVisitStatsDataSourceId === undefined) {
      delete process.env.NOTION_VISIT_STATS_DATASOURCE_ID
    } else {
      process.env.NOTION_VISIT_STATS_DATASOURCE_ID = previousVisitStatsDataSourceId
    }

    if (previousVisitorHashSalt === undefined) {
      delete process.env.VISITOR_HASH_SALT
    } else {
      process.env.VISITOR_HASH_SALT = previousVisitorHashSalt
    }
  })

  it("creates a stats row and updates the page count for a new visitor", async () => {
    let trackedKey = ""
    mockNotion.dataSources.query
      .mockImplementationOnce(async (query: unknown) => {
        trackedKey = captureVisitKeyFromQuery(query)
        return queryResponse([])
      })
      .mockImplementationOnce(async () => queryResponse([visitRow(trackedKey)]))
    mockNotion.pages.retrieve.mockResolvedValue(trackedPage(0))

    const result = await trackUniqueVisit(input)

    expect(result).toEqual({ counted: true, count: 1 })
    expect(mockNotion.pages.create).toHaveBeenCalledTimes(1)

    const createArg = mockNotion.pages.create.mock.calls[0][0] as {
      parent: { data_source_id: string }
      properties: {
        Slug: { rich_text: Array<{ text: { content: string } }> }
        PostId: { rich_text: Array<{ text: { content: string } }> }
        VisitKey: { rich_text: Array<{ text: { content: string } }> }
      }
    }

    expect(createArg.parent).toEqual({ data_source_id: "stats-ds" })
    expect(createArg.properties.Slug.rich_text[0].text.content).toBe("hello")
    expect(createArg.properties.PostId.rich_text[0].text.content).toBe("page-1")
    expect(createArg.properties.VisitKey.rich_text[0].text.content).toBe(trackedKey)
    expect(mockNotion.pages.update).toHaveBeenCalledWith({
      page_id: "page-1",
      properties: { 접속자수: { number: 1 } },
    })
  })

  it("uses the ensured key when Notion has not indexed the new row yet", async () => {
    mockNotion.dataSources.query
      .mockResolvedValueOnce(queryResponse([]))
      .mockResolvedValueOnce(queryResponse([]))
    mockNotion.pages.retrieve.mockResolvedValue(trackedPage(0))

    const result = await trackUniqueVisit(input)

    expect(result).toEqual({ counted: true, count: 1 })
    expect(mockNotion.pages.update).toHaveBeenCalledWith({
      page_id: "page-1",
      properties: { 접속자수: { number: 1 } },
    })
  })

  it("does not create a duplicate row when the visitor already exists and the count is current", async () => {
    let trackedKey = ""
    mockNotion.dataSources.query
      .mockImplementationOnce(async (query: unknown) => {
        trackedKey = captureVisitKeyFromQuery(query)
        return queryResponse([visitRow(trackedKey)])
      })
      .mockImplementationOnce(async () => queryResponse([visitRow(trackedKey)]))
    mockNotion.pages.retrieve.mockResolvedValue(trackedPage(1))

    const result = await trackUniqueVisit(input)

    expect(result).toEqual({ counted: false, count: 1 })
    expect(mockNotion.pages.create).not.toHaveBeenCalled()
    expect(mockNotion.pages.update).not.toHaveBeenCalled()
  })

  it("repairs a stale page count on a repeat visit", async () => {
    let trackedKey = ""
    mockNotion.dataSources.query
      .mockImplementationOnce(async (query: unknown) => {
        trackedKey = captureVisitKeyFromQuery(query)
        return queryResponse([visitRow(trackedKey)])
      })
      .mockImplementationOnce(async () => queryResponse([visitRow(trackedKey), visitRow("second-key")]))
    mockNotion.pages.retrieve.mockResolvedValue(trackedPage(1))

    const result = await trackUniqueVisit(input)

    expect(result).toEqual({ counted: false, count: 2 })
    expect(mockNotion.pages.create).not.toHaveBeenCalled()
    expect(mockNotion.pages.update).toHaveBeenCalledWith({
      page_id: "page-1",
      properties: { 접속자수: { number: 2 } },
    })
  })

  it("counts distinct visit keys even when duplicate rows exist across pages", async () => {
    let trackedKey = ""
    mockNotion.dataSources.query
      .mockImplementationOnce(async (query: unknown) => {
        trackedKey = captureVisitKeyFromQuery(query)
        return queryResponse([visitRow(trackedKey)])
      })
      .mockImplementationOnce(async () => queryResponse([visitRow(trackedKey, "dup-1")], "cursor-2"))
      .mockImplementationOnce(async () => queryResponse([visitRow(trackedKey, "dup-2")]))
    mockNotion.pages.retrieve.mockResolvedValue(trackedPage(0))

    const result = await trackUniqueVisit(input)

    expect(result).toEqual({ counted: false, count: 1 })
    expect(mockNotion.pages.update).toHaveBeenCalledWith({
      page_id: "page-1",
      properties: { 접속자수: { number: 1 } },
    })
  })

  it("coalesces concurrent identical requests into a single Notion write", async () => {
    const existsQuery = deferred<QueryResponseStub>()
    let trackedKey = ""
    mockNotion.dataSources.query
      .mockImplementationOnce(async (query: unknown) => {
        trackedKey = captureVisitKeyFromQuery(query)
        return existsQuery.promise
      })
      .mockImplementationOnce(async () => queryResponse([visitRow(trackedKey)]))
    mockNotion.pages.retrieve.mockResolvedValue(trackedPage(0))

    const first = trackUniqueVisit(input)
    const second = trackUniqueVisit(input)

    existsQuery.resolve(queryResponse([]))

    const [firstResult, secondResult] = await Promise.all([first, second])

    expect(firstResult).toEqual({ counted: true, count: 1 })
    expect(secondResult).toEqual({ counted: true, count: 1 })
    expect(mockNotion.pages.create).toHaveBeenCalledTimes(1)
    expect(mockNotion.dataSources.query).toHaveBeenCalledTimes(2)
  })

  it("rejects when the visit stats datasource id is missing", async () => {
    delete process.env.NOTION_VISIT_STATS_DATASOURCE_ID

    await expect(trackUniqueVisit(input)).rejects.toThrow(
      "NOTION_VISIT_STATS_DATASOURCE_ID is required"
    )
  })

  it("rejects when the visitor hash salt is missing", async () => {
    delete process.env.VISITOR_HASH_SALT

    await expect(trackUniqueVisit(input)).rejects.toThrow("VISITOR_HASH_SALT is required")
  })

  it.each(schemaFailureCases)("rejects when $name", async ({ page }) => {
    let trackedKey = ""
    mockNotion.dataSources.query
      .mockImplementationOnce(async (query: unknown) => {
        trackedKey = captureVisitKeyFromQuery(query)
        return queryResponse([visitRow(trackedKey)])
      })
      .mockImplementationOnce(async () => queryResponse([visitRow(trackedKey)]))
    mockNotion.pages.retrieve.mockResolvedValue(page)

    await expect(trackUniqueVisit(input)).rejects.toThrow(
      "Notion property 접속자수 must be a number"
    )
  })
})
