import { NextApiRequest, NextApiResponse } from "next"
import { getOrBuildOntology } from "src/apis/ontology/getOntology"
import { verifyRevalidateToken } from "src/libs/utils/auth/verifyToken"

// Called daily by an external cron service.
// Example: curl -X POST https://yourdomain/api/cron/ontology -H "Authorization: Bearer <REVALIDATE_SECRET>"
// Add ?force=1 to bypass all caches (full rebuild).
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") return res.status(405).end()
  if (!verifyRevalidateToken(req)) return res.status(401).json({ message: "Invalid token" })

  const bypassCache = req.query.force === "1"

  try {
    const { ontology, stats } = await getOrBuildOntology({ bypassCache })
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
