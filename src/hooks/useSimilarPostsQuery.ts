import { useQuery } from "@tanstack/react-query"
import type { SimilarPost } from "src/pages/api/similar"

async function fetchSimilarPosts(postId: string, limit = 5): Promise<SimilarPost[]> {
  const res = await fetch(`/api/similar?postId=${encodeURIComponent(postId)}&limit=${limit}`)
  if (!res.ok || res.status === 202) return []
  const data = await res.json()
  return data.results ?? []
}

const useSimilarPostsQuery = (postId: string, limit = 5) => {
  const { data, isLoading } = useQuery<SimilarPost[]>({
    queryKey: ["similar", postId, limit],
    queryFn: () => fetchSimilarPosts(postId, limit),
    staleTime: 60 * 60 * 1000,
    gcTime: 4 * 60 * 60 * 1000,
    refetchOnWindowFocus: false,
    enabled: !!postId,
  })

  return { similar: data ?? [], isLoading }
}

export default useSimilarPostsQuery
