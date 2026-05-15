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

const useNotionGraphQuery = (): BuiltGraph => {
  const { data } = useQuery<BuiltGraph>({
    queryKey: queryKey.notionGraph(),
    queryFn: async () => {
      try {
        const res = await fetch("/graphs/notion-graph.json", { cache: "no-store" })
        if (!res.ok) return EMPTY_GRAPH
        return (await res.json()) as BuiltGraph
      } catch {
        return EMPTY_GRAPH
      }
    },
    staleTime: 60 * 60 * 1000,
    gcTime: 60 * 60 * 1000,
    refetchOnWindowFocus: false,
  })

  return data ?? EMPTY_GRAPH
}

export default useNotionGraphQuery
