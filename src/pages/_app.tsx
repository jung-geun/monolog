import { AppPropsWithLayout } from "../types"
import { HydrationBoundary, QueryClientProvider } from "@tanstack/react-query"
import { RootLayout } from "src/layouts"
import { queryClient } from "src/libs/react-query"
import GoogleAnalytics from "src/components/GoogleAnalytics"
import { JetBrains_Mono } from "next/font/google"
import { useEffect } from "react"
import { useRouter } from "next/router"

export const jetbrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  variable: "--font-mono",
  display: "swap",
})

// Disable console.log in production
if (process.env.NODE_ENV === 'production') {
  console.log = () => {}
}

function App({ Component, pageProps }: AppPropsWithLayout) {
  const getLayout = Component.getLayout || ((page) => page)
  const router = useRouter()

  // ⌘K / Ctrl+K global listener — opens command palette
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault()
        // Dispatch a custom event that CommandPalette listens to
        window.dispatchEvent(new CustomEvent("open-command-palette"))
      }
    }
    window.addEventListener("keydown", handler)
    return () => window.removeEventListener("keydown", handler)
  }, [])

  return (
    <QueryClientProvider client={queryClient}>
      <HydrationBoundary state={pageProps.dehydratedState}>
        <div className={jetbrainsMono.variable} style={{ height: "100%" }}>
          <RootLayout>{getLayout(<Component {...pageProps} />)}</RootLayout>
        </div>
        <GoogleAnalytics />
      </HydrationBoundary>
    </QueryClientProvider>
  )
}

export default App
