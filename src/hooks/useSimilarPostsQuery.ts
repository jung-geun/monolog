import { useQuery } from "@tanstack/react-query"
import type { SimilarPost } from "src/pages/api/similar"

type SimilarPostsData = { results: SimilarPost[]; pending: boolean }

async function fetchSimilarPosts(postId: string, limit = 5): Promise<SimilarPostsData> {
  const res = await fetch(`/api/similar?postId=${encodeURIComponent(postId)}&limit=${limit}`)
  if (res.status === 202) return { results: [], pending: true }
  if (!res.ok) throw new Error(`Failed to fetch similar posts: HTTP ${res.status}`)
  const data = await res.json()
  return { results: data.results ?? [], pending: false }
}

const useSimilarPostsQuery = (postId: string, limit = 5) => {
  const { data, isLoading } = useQuery<SimilarPostsData>({
    queryKey: ["similar", postId, limit],
    queryFn: () => fetchSimilarPosts(postId, limit),
    staleTime: query => query.state.data?.pending ? 0 : 60 * 60 * 1000,
    refetchInterval: query => query.state.data?.pending ? 3_000 : false,
    gcTime: 4 * 60 * 60 * 1000,
    refetchOnWindowFocus: false,
    enabled: !!postId,
  })

  return { similar: data?.results ?? [], isLoading }
}

export default useSimilarPostsQuery
