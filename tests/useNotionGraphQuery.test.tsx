import React from "react"
import { renderToStaticMarkup } from "react-dom/server"

jest.mock("@tanstack/react-query", () => ({
  useQuery: jest.fn(),
}))

import { useQuery } from "@tanstack/react-query"
import useNotionGraphQuery, {
  fetchNotionGraph,
  STALE_GRAPH_REFETCH_INTERVAL_MS,
} from "src/hooks/useNotionGraphQuery"

const graph = {
  nodes: [],
  edges: [],
  cats: [],
  catCenters: {},
  generatedAt: "2026-08-11T00:00:00.000Z",
}

const GraphQuery = () => {
  useNotionGraphQuery()
  return null
}

describe("useNotionGraphQuery", () => {
  const originalFetch = global.fetch

  afterEach(() => {
    global.fetch = originalFetch
    jest.clearAllMocks()
  })

  it("marks a stale graph response for retry", async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: jest.fn().mockResolvedValue(graph),
      headers: new Headers({ "X-Monolog-Graph-Stale": "1" }),
    })

    await expect(fetchNotionGraph()).resolves.toEqual({ graph, isStale: true })
    expect(global.fetch).toHaveBeenCalledWith("/graphs/notion-graph.json", {
      cache: "no-store",
    })
  })

  it("throws when fetching the graph receives a non-200 HTTP response", async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: false,
      status: 500,
    })

    await expect(fetchNotionGraph()).rejects.toThrow(
      "Failed to fetch notion graph: HTTP 500"
    )
  })

  it("propagates a network failure so React Query retains the prior graph", async () => {
    global.fetch = jest.fn().mockRejectedValue(new Error("network unavailable"))

    await expect(fetchNotionGraph()).rejects.toThrow("network unavailable")
  })

  it("retries only a stale graph and stops once it is current", () => {
    ;(useQuery as jest.Mock).mockReturnValue({ data: undefined })
    renderToStaticMarkup(<GraphQuery />)

    const options = (useQuery as jest.Mock).mock.calls[0][0]
    expect(options.staleTime({ state: { data: { isStale: true } } })).toBe(0)
    expect(options.refetchInterval({ state: { data: { isStale: true } } })).toBe(
      STALE_GRAPH_REFETCH_INTERVAL_MS
    )
    expect(options.refetchInterval({ state: { data: { isStale: false } } })).toBe(false)
  })
})
