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

  const body: Record<string, unknown> = req.body !== null && typeof req.body === "object" && !Array.isArray(req.body)
    ? req.body : {}
  const path = body.path === undefined ? req.query.path : body.path
  const full = body.full === undefined ? req.query.full : body.full
  if (path !== undefined && (typeof path !== "string" || !path.startsWith("/") || path.startsWith("//") || /[\\\u0000-\u001f\u007f?#]/.test(path))) {
    return res.status(400).json({ message: "Path must be a scalar local route" })
  }
  if (full !== undefined && full !== true && full !== false && full !== "true" && full !== "false") {
    return res.status(400).json({ message: "Full must be true or false" })
  }

  try {
    const result = await reconcileContent({
      revalidate: route => res.revalidate(route),
      maintenance: false,
      ...(typeof path === "string" ? { path } : {}),
      ...(full !== undefined ? { full: full === true || full === "true" } : {}),
    })
    const status = result.failed.length ? "failed" : result.pending.length ? "pending" : "completed"
    return res.status(status === "completed" ? 200 : 503).json({
      status, completed: result.completed, changed: result.changed,
      pending: result.pending.length, failed: result.failed.length, revision: result.revision,
      maintenancePending: result.maintenancePending,
      notificationsPending: result.notificationsPending,
    })
  } catch (error) {
    if (error && typeof error === "object" && "statusCode" in error && error.statusCode === 400) {
      return res.status(400).json({ message: "Invalid content path" })
    }
    return res.status(503).json({ status: "failed", message: "Content reconciliation failed" })
  }
}
