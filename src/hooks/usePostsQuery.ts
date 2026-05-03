import { useQuery } from "@tanstack/react-query"
import { queryKey } from "src/constants/queryKey"
import { TPost } from "src/types"

const usePostsQuery = () => {
  const { data } = useQuery<TPost[]>({
    queryKey: queryKey.posts(),
    queryFn: () => [] as TPost[],
    staleTime: 10 * 60 * 1000,
    gcTime: 60 * 60 * 1000,
    refetchOnWindowFocus: false,
    enabled: false,
  })

  return data ?? []
}

export default usePostsQuery
