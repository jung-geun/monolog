import { useQuery } from "@tanstack/react-query"
import { queryKey } from "src/constants/queryKey"
import type { BuiltGraph } from "src/apis/notion-client/getBuiltGraph"

const EMPTY_GRAPH: BuiltGraph = {
  nodes: [],
  edges: [],
  cats: [],
  catCenters: {},
  generatedAt: "",
}

const FRESH_GRAPH_STALE_TIME_MS = 60 * 60 * 1000
export const STALE_GRAPH_REFETCH_INTERVAL_MS = 3_000

type NotionGraphQueryData = {
  graph: BuiltGraph
  isStale: boolean
}

export const fetchNotionGraph = async (): Promise<NotionGraphQueryData> => {
  const res = await fetch("/graphs/notion-graph.json", { cache: "no-store" })
  if (!res.ok) {
    throw new Error(`Failed to fetch notion graph: HTTP ${res.status}`)
  }

  return {
    graph: (await res.json()) as BuiltGraph,
    isStale: res.headers.get("X-Monolog-Graph-Stale") === "1",
  }
}

const useNotionGraphQuery = (): BuiltGraph => {
  const { data } = useQuery<NotionGraphQueryData>({
    queryKey: queryKey.notionGraph(),
    queryFn: fetchNotionGraph,
    staleTime: (query) =>
      query.state.data?.isStale ? 0 : FRESH_GRAPH_STALE_TIME_MS,
    gcTime: FRESH_GRAPH_STALE_TIME_MS,
    refetchInterval: (query) =>
      query.state.data?.isStale ? STALE_GRAPH_REFETCH_INTERVAL_MS : false,
    refetchIntervalInBackground: false,
    refetchOnWindowFocus: false,
  })

  return data?.graph ?? EMPTY_GRAPH
}

export default useNotionGraphQuery
