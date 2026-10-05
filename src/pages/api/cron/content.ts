import type { NextApiRequest, NextApiResponse } from "next"
import { reconcileContent } from "src/libs/content"
import { verifyRevalidateToken } from "src/libs/utils/auth/verifyToken"

export const config = { maxDuration: 900 }

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "GET" && req.method !== "POST") {
    res.setHeader("Allow", "GET, POST")
    return res.status(405).json({ message: "Method not allowed" })
  }
  if (!verifyRevalidateToken(req)) {
    return res.status(401).json({ message: "Invalid token" })
  }

  try {
    // The engine chooses incremental scans and its automatic daily full scan.
    const result = await reconcileContent({ revalidate: path => res.revalidate(path) })
    const status = result.failed.length ? "failed" : result.pending.length ? "pending" : "completed"
    return res.status(status === "completed" ? 200 : 503).json({
      status, completed: result.completed, changed: result.changed,
      pending: result.pending.length, failed: result.failed.length, revision: result.revision,
      maintenancePending: result.maintenancePending,
      notificationsPending: result.notificationsPending,
    })
  } catch {
    return res.status(503).json({ status: "failed", message: "Content reconciliation failed" })
  }
}
