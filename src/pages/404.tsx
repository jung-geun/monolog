import type { NextPageWithLayout } from "src/types"
import MetaConfig from "src/components/MetaConfig"
import { CONFIG } from "site.config"

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
