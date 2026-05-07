import "../styles/globals.css"
import { AppPropsWithLayout } from "../types"
import { HydrationBoundary, QueryClientProvider } from "@tanstack/react-query"
import { RootLayout } from "src/layouts"
import { queryClient as sharedQueryClient, createServerQueryClient } from "src/libs/react-query"
import GoogleAnalytics from "src/components/GoogleAnalytics"
import { JetBrains_Mono } from "next/font/google"
import Head from "next/head"
import { useEffect, useState } from "react"
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
  // Server always gets a fresh QueryClient; browser reuses the shared singleton.
  // This prevents React Query v5's HydrationBoundary from deferring existing
  // queries to useEffect (which never runs on the server), causing hydration mismatches.
  const [qClient] = useState(() =>
    typeof window === "undefined" ? createServerQueryClient() : sharedQueryClient
  )

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
    <QueryClientProvider client={qClient}>
      <HydrationBoundary state={pageProps.dehydratedState}>
        <Head>
          <meta
            name="viewport"
            content="width=device-width, initial-scale=1, viewport-fit=cover"
          />
        </Head>
        <div className={jetbrainsMono.variable} style={{ height: "100%" }}>
          <RootLayout>{getLayout(<Component {...pageProps} />)}</RootLayout>
        </div>
        <GoogleAnalytics />
      </HydrationBoundary>
    </QueryClientProvider>
  )
}

export default App
