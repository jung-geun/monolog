import { QueryClient } from "@tanstack/react-query"

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 10 * 60 * 1000, // 10분 동안 데이터를 fresh로 유지
      cacheTime: 60 * 60 * 1000, // 1시간 동안 캐시 보관
      refetchOnWindowFocus: false, // 윈도우 포커스 시 자동 refetch 방지
      refetchOnMount: true, // 마운트시 stale한 데이터면 refetch
      refetchOnReconnect: true, // 재연결시 refetch
    },
  },
})
