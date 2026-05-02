import { useQuery } from "@tanstack/react-query"
import { queryKey } from "src/constants/queryKey"
import { TPost } from "src/types"

const usePostsQuery = () => {
  const { data } = useQuery(
    queryKey.posts(),
    () => {
      // 이 함수는 실행되지 않아야 함 (enabled: false)
      return [] as TPost[]
    },
    {
      staleTime: 10 * 60 * 1000, // 10분 동안 fresh 유지
      cacheTime: 60 * 60 * 1000, // 1시간 동안 캐시 보관
      refetchOnWindowFocus: false,
      enabled: false, // 클라이언트에서 fetch 하지 않음
    }
  )

  return data ?? []
}

export default usePostsQuery
