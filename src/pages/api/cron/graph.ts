import type { NextApiRequest, NextApiResponse } from "next"
import { refreshGraphSnapshotInQdrant } from "src/apis/notion-client/graphSnapshot"
import { verifyRevalidateToken } from "src/libs/utils/auth/verifyToken"

// Called daily by an external cron service (e.g. crontab, GitHub Actions).
// Example: curl -X POST https://yourdomain/api/cron/graph -H "Authorization: Bearer <REVALIDATE_TOKEN>"
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") return res.status(405).end()
  if (!verifyRevalidateToken(req)) return res.status(401).json({ message: "Invalid token" })

  try {
    const { builtGraph } = await refreshGraphSnapshotInQdrant({ bypassCache: true })
    res.json({
      ok: true,
      nodes: builtGraph.nodes.length,
      edges: builtGraph.edges.length,
      revalidatedAt: new Date().toISOString(),
    })
  } catch (err) {
    console.error("[cron/graph]", err)
    res.status(500).json({ ok: false })
  }
}
