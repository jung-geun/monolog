import { QueryClient } from "@tanstack/react-query"

const defaultOptions = {
  queries: {
    staleTime: 10 * 60 * 1000,
    gcTime: 60 * 60 * 1000,
    refetchOnWindowFocus: false,
    refetchOnMount: true,
    refetchOnReconnect: true,
  },
}

// 클라이언트 전용 싱글톤 (브라우저에서 _app.tsx의 QueryClientProvider에 주입)
export const queryClient = new QueryClient({ defaultOptions })

// SSG/ISR getStaticProps용 — 매 호출마다 새 인스턴스 생성하여
// 페이지 간 캐시 오염(prefetchQuery가 staleTime 안에 fetcher 건너뜀)을 방지한다.
export const createServerQueryClient = () => new QueryClient({ defaultOptions })
