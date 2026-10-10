import { NextApiRequest, NextApiResponse } from "next"
import { getOrBuildOntology } from "src/apis/ontology/getOntology"
import { verifyRevalidateToken } from "src/libs/utils/auth/verifyToken"
import { readContentSnapshot } from "src/libs/content"
import { reconcilePostEmbeddings } from "src/apis/vector/postEmbeddings"
import { withContentLock } from "src/libs/content/storage"
import { snapshotOf } from "src/libs/content/snapshot"

// Called daily by an external cron service.
// Example: curl -X POST https://yourdomain/api/cron/ontology -H "Authorization: Bearer <REVALIDATE_SECRET>"
// Add ?force=1 to rebuild the LLM ontology; unchanged document vectors stay committed.
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") return res.status(405).end()
  if (!verifyRevalidateToken(req)) return res.status(401).json({ message: "Invalid token" })

  const bypassCache = req.query.force === "1"

  try {
    const prepare = () => withContentLock(async load => {
      const state = await load()
      if (!state?.initialized) return null
      const snapshot = snapshotOf(state)
      const embeddings = await reconcilePostEmbeddings(snapshot, Date.now() + 12 * 60 * 1000)
      return { snapshot, embeddings }
    })
    let prepared = await prepare()
    if (!prepared) {
      // Bootstrap may acquire the same lock, so perform it outside this lease.
      await readContentSnapshot()
      prepared = await prepare()
    }
    if (!prepared) throw new Error("Content baseline is not initialized")
    const { snapshot, embeddings } = prepared
    if (embeddings.pending.length || embeddings.failed.length) {
      return res.status(503).json({ ok: false, error: "Post embeddings are pending", pending: embeddings.pending })
    }
    const { ontology, stats } = await getOrBuildOntology({ bypassCache, posts: snapshot.posts })
    res.json({
      ok: true,
      entities: ontology.entities.length,
      edges: ontology.edges.length,
      generatedAt: ontology.generatedAt,
      bypassCache,
      ...stats,
    })
  } catch (err) {
    console.error("[cron/ontology]", err)
    res.status(500).json({ ok: false, error: "failed to build ontology" })
  }
}
