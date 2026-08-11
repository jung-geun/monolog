import { useEffect } from "react"
import { useRouter } from "next/compat/router"
import { CONFIG } from "site.config"
import { trackPageView } from "src/libs/analytics/ga"

const useGtagEffect = () => {
  const router = useRouter()

  useEffect(() => {
    if (!router || !CONFIG.isProd) return

    const handleRouteChange = (url: string) => trackPageView(url)
    router.events.on("routeChangeComplete", handleRouteChange)
    return () => router.events.off("routeChangeComplete", handleRouteChange)
  }, [router])
}

export default useGtagEffect
