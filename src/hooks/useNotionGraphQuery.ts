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
    queryFn: () => EMPTY_GRAPH,
    staleTime: 60 * 60 * 1000,
    gcTime: 60 * 60 * 1000,
    refetchOnWindowFocus: false,
    enabled: false,
  })

  return data ?? EMPTY_GRAPH
}

export default useNotionGraphQuery
