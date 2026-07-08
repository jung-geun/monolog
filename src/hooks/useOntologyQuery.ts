import { useQuery } from "@tanstack/react-query"
import type { Ontology } from "src/types/ontology"

async function fetchOntology(): Promise<Ontology | null> {
  const res = await fetch("/graphs/ontology.json")
  if (!res.ok || res.status === 202) return null
  return res.json()
}

const useOntologyQuery = () => {
  const { data, isLoading } = useQuery<Ontology | null>({
    queryKey: ["ontology"],
    queryFn: fetchOntology,
    staleTime: 60 * 60 * 1000,
    gcTime: 4 * 60 * 60 * 1000,
    refetchOnWindowFocus: false,
  })

  return { ontology: data ?? null, isLoading }
}

export default useOntologyQuery
