import { dehydrate } from "@tanstack/react-query"
import { GetStaticProps } from "next"
import type { NextPageWithLayout } from "src/types"
import { getPosts } from "src/apis/notion-client/getPosts"
import MetaConfig from "src/components/MetaConfig"
import { createServerQueryClient } from "src/libs/react-query"
import { prefetchFeedPosts } from "src/libs/react-query/prefetchFeedPosts"
import { CONFIG } from "site.config"

export const getStaticProps: GetStaticProps = async () => {
  const queryClient = createServerQueryClient()
  await prefetchFeedPosts(queryClient, await getPosts())

  return {
    props: { dehydratedState: dehydrate(queryClient) },
  }
}

const NotFoundPage: NextPageWithLayout = () => (
  <>
    <MetaConfig
      title={`404 — ${CONFIG.blog.title}`}
      description="Page not found"
      type="website"
      url={`${CONFIG.link}/404`}
    />
    <main
      style={{
        minHeight: "100%",
        display: "grid",
        placeItems: "center",
        padding: "48px 24px",
      }}
    >
      <div style={{ textAlign: "center" }}>
        <h1 style={{ marginBottom: 12, fontSize: 28 }}>404</h1>
        <p>Page not found.</p>
      </div>
    </main>
  </>
)

export default NotFoundPage
