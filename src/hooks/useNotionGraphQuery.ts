import { useQuery } from "@tanstack/react-query"
import { queryKey } from "src/constants/queryKey"
import { NotionGraph } from "src/types/notionGraph"

const EMPTY_GRAPH: NotionGraph = {
  version: "v1",
  generatedAt: "",
  nodes: [],
  edges: [],
}

const useNotionGraphQuery = (): NotionGraph => {
  const { data } = useQuery<NotionGraph>({
    queryKey: queryKey.notionGraph(),
    queryFn: async () => {
      try {
        const res = await fetch("/graphs/notion-graph.json", { cache: "no-store" })
        if (!res.ok) return EMPTY_GRAPH
        return (await res.json()) as NotionGraph
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
