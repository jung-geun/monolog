/**
 * @jest-environment node
 */

import type { TPost } from "src/types"
import type { OntologyState } from "src/types/ontology"

const store = new Map<string, unknown>()
const list = jest.fn()

jest.mock("src/libs/cache", () => ({
  cacheStore: {
    get: jest.fn(async (key: string) => (store.has(key) ? structuredClone(store.get(key)) : null)),
    set: jest.fn(async (key: string, value: unknown) => void store.set(key, structuredClone(value))),
    getShared: jest.fn(async (key: string) => (store.has(key) ? structuredClone(store.get(key)) : null)),
    setShared: jest.fn(async (key: string, value: unknown) => void store.set(key, structuredClone(value))),
  },
  keys: {
    postGraphExtraction: (id: string, version: string) => `extraction:${id}:${version}`,
    embedding: (id: string, version: string) => `embedding:${id}:${version}`,
    postOntology: (id: string, version: string) => `postOntology:${id}:${version}`,
    ontologyState: "ontologyState",
  },
}))
jest.mock("src/apis/notion-client/notionClient", () => ({
  getOfficialNotionClient: () => ({ blocks: { children: { list } } }),
}))
jest.mock("src/apis/notion-client/getPosts", () => ({ getPosts: jest.fn() }))
jest.mock("src/apis/ontology/extractPostOntology", () => ({ extractPostOntology: jest.fn() }))
jest.mock("src/apis/ontology/extractRelations", () => ({ extractRelations: jest.fn(async () => []) }))
jest.mock("src/apis/vector/qdrantClient", () => ({
  searchSimilar: jest.fn(async () => []),
  normalizeUUID: (id: string) => id,
  deletePoint: jest.fn(),
  updatePostPayload: jest.fn(),
}))
jest.mock("src/libs/utils/logger", () => ({ warnLog: jest.fn(), debugLog: jest.fn() }))

import { buildNotionGraph } from "src/apis/notion-client/buildNotionGraph"
import { getOrBuildOntology } from "src/apis/ontology/getOntology"
import { extractPostOntology } from "src/apis/ontology/extractPostOntology"
import { deletePoint, updatePostPayload } from "src/apis/vector/qdrantClient"

const BODY_ID = "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb"
const post = (id: string, overrides: Partial<TPost> = {}): TPost => ({
  id,
  title: `Post ${id}`,
  slug: `post-${id.slice(0, 1)}`,
  createdTime: "2026-01-01T00:00:00.000Z",
  lastEditedTime: "2026-01-02T00:00:00.000Z",
  contentHash: "v1",
  date: { start_date: "2026-01-01" },
  type: ["Post"],
  status: ["Public"],
  fullWidth: false,
  ...overrides,
})
const a = post("aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa")
const b = post(BODY_ID)
const mentionOfB = {
  id: "block-a", type: "paragraph", has_children: false,
  paragraph: { rich_text: [{ type: "mention", plain_text: "see B", mention: { type: "page", page: { id: BODY_ID } } }] },
}

beforeEach(() => {
  store.clear()
  jest.clearAllMocks()
  list.mockImplementation(async ({ block_id }: { block_id: string }) => ({
    results: block_id === a.id ? [mentionOfB] : [],
    has_more: false,
  }))
})

const fetchedPages = () => list.mock.calls.map(([args]) => args.block_id)

describe("incremental graph extraction", () => {
  it("links to a newly public page from cached references without refetching the unchanged source", async () => {
    const first = await buildNotionGraph([a, { ...b, status: ["Private"] }])
    expect(first.edges.filter((edge) => edge.type === "mention")).toEqual([])
    list.mockClear()

    const second = await buildNotionGraph([a, b])

    expect(fetchedPages()).toEqual([b.id])
    expect(second.edges).toContainEqual({ source: a.id, target: b.id, type: "mention", weight: 1, contexts: ["see B"] })
  })

  it("refetches only the page whose content version changed", async () => {
    await buildNotionGraph([a, b])
    list.mockClear()

    await buildNotionGraph([{ ...a, contentHash: "v2" }, { ...b, title: "metadata only" }])

    expect(fetchedPages()).toEqual([a.id])
  })

  it("marks an upstream extraction failure partial and retries that page next time", async () => {
    list.mockImplementation(async ({ block_id }: { block_id: string }) => {
      if (block_id === b.id) throw new Error("Notion 502")
      return { results: [], has_more: false }
    })
    await expect(buildNotionGraph([a, b])).resolves.toMatchObject({ partial: true })

    list.mockClear()
    list.mockResolvedValue({ results: [], has_more: false })
    const retried = await buildNotionGraph([a, b])

    expect(fetchedPages()).toEqual([b.id])
    expect(retried.partial).toBeUndefined()
  })
})

describe("incremental ontology maintenance", () => {
  const seedState = (index: Record<string, string>) => {
    const state: OntologyState = {
      version: "v2", generatedAt: "2026-01-01T00:00:00.000Z",
      entities: [{ id: "e", kind: "tech", name: "Rust", aliases: [], postIds: [a.id, b.id] }],
      edges: [{ source: a.id, target: b.id, kind: "supports", confidence: 0.9 }],
      index,
    }
    store.set("ontologyState", state)
  }

  it("does no extraction work when nothing semantic changed", async () => {
    seedState({ [a.id]: "v1", [b.id]: "v1" })

    await getOrBuildOntology({ posts: [a, b], changedIds: [], removedIds: [] })

    expect(extractPostOntology).not.toHaveBeenCalled()
    expect(updatePostPayload).not.toHaveBeenCalled()
  })

  it("migrates a matching existing checkpoint to body hashes without a full AI rebuild", async () => {
    seedState({ [a.id]: a.lastEditedTime!, [b.id]: b.lastEditedTime! })
    const previous = structuredClone(store.get("ontologyState")) as OntologyState
    const result = await getOrBuildOntology({ posts: [a, b], changedIds: [a.id, b.id] })

    expect(extractPostOntology).not.toHaveBeenCalled()
    expect(result.stats.modified).toBe(0)
    expect(result.ontology.entities).toEqual(previous.entities)
    expect(result.ontology.edges).toEqual(previous.edges)
    expect((store.get("ontologyState") as OntologyState).index).toEqual({ [a.id]: "v1", [b.id]: "v1" })
  })

  it("updates vector metadata without LLM work for a metadata-only change", async () => {
    seedState({ [a.id]: "v1", [b.id]: "v1" })

    await getOrBuildOntology({ posts: [{ ...a, slug: "renamed" }, b], changedIds: [a.id], removedIds: [] })

    expect(extractPostOntology).not.toHaveBeenCalled()
    expect(updatePostPayload).toHaveBeenCalledWith(expect.objectContaining({ id: a.id, slug: "renamed" }))
  })

  it("removes a now-private post from vectors and semantic state", async () => {
    seedState({ [a.id]: "v1", [b.id]: "v1" })

    await getOrBuildOntology({ posts: [a, { ...b, status: ["Private"] }], changedIds: [b.id], removedIds: [] })

    const state = store.get("ontologyState") as OntologyState
    expect(deletePoint).toHaveBeenCalledWith(b.id)
    expect(state.index).toEqual({ [a.id]: "v1" })
    expect(state.edges).toEqual([])
    expect(state.entities[0].postIds).toEqual([a.id])
  })

  it("keeps a removed post indexed when its vector delete fails, so the next run retries it", async () => {
    seedState({ [a.id]: "v1", [b.id]: "v1" })
    ;(deletePoint as jest.Mock).mockRejectedValueOnce(new Error("Qdrant down"))

    await expect(getOrBuildOntology({ posts: [a], changedIds: [], removedIds: [b.id] })).rejects.toThrow()
    expect((store.get("ontologyState") as OntologyState).index).toHaveProperty(b.id)

    await getOrBuildOntology({ posts: [a], changedIds: [], removedIds: [] })
    expect(deletePoint).toHaveBeenLastCalledWith(b.id)
    expect((store.get("ontologyState") as OntologyState).index).toEqual({ [a.id]: "v1" })
  })
})

describe("ontology failure isolation", () => {
  it("commits other posts when one extraction keeps failing, and still reports failure for retry", async () => {
    ;(extractPostOntology as jest.Mock).mockImplementation(async (target: TPost) => {
      if (target.id === a.id) throw new Error("LLM 400")
      return { postId: target.id, summary: "ok", entities: [] }
    })

    await expect(getOrBuildOntology({ posts: [a, b], changedIds: [a.id, b.id], removedIds: [] })).rejects.toThrow()

    expect((store.get("ontologyState") as OntologyState).index).toEqual({ [b.id]: "v1" })
  })
})
