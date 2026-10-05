import type { NextApiRequest, NextApiResponse } from "next"
import { enqueueContentEvent, reconcileContent } from "src/libs/content"
import { warnLog } from "src/libs/utils/logger"
import {
  MAX_WEBHOOK_BODY_BYTES,
  parseVerificationRequest,
  parseWebhookEvent,
  verifyWebhookSignature,
} from "src/libs/content/webhook"

export const config = { api: { bodyParser: false }, maxDuration: 900 }

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST")
    return res.status(405).json({ message: "Method not allowed" })
  }

  const contentLength = req.headers["content-length"]
  if (typeof contentLength === "string" && Number(contentLength) > MAX_WEBHOOK_BODY_BYTES) {
    res.setHeader("Connection", "close")
    return res.status(413).json({ message: "Payload too large" })
  }

  let rawBody: Buffer
  try {
    const chunks: Buffer[] = []
    let bytes = 0
    // Do not destroy the socket on an early exit: the caller still needs its 413.
    for await (const chunk of req.iterator({ destroyOnReturn: false })) {
      const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)
      bytes += buffer.length
      if (bytes > MAX_WEBHOOK_BODY_BYTES) {
        res.setHeader("Connection", "close")
        return res.status(413).json({ message: "Payload too large" })
      }
      chunks.push(buffer)
    }
    rawBody = Buffer.concat(chunks, bytes)
  } catch {
    return res.status(400).json({ message: "Invalid request body" })
  }

  const token = process.env.NOTION_WEBHOOK_VERIFICATION_TOKEN
  if (!token) {
    // Before a signing secret exists, accept only Notion's one-time subscription
    // handshake and surface its token in the server log for the operator.
    let verification: string | null
    try { verification = parseVerificationRequest(JSON.parse(rawBody.toString("utf8"))) } catch { verification = null }
    if (!verification) return res.status(503).json({ message: "Webhook authentication unavailable" })
    warnLog(`[notion-webhook] verification_token=${verification}; verify it in Notion and set NOTION_WEBHOOK_VERIFICATION_TOKEN`)
    return res.status(200).json({ message: "Verification token received" })
  }

  if (!verifyWebhookSignature(rawBody, req.headers["x-notion-signature"], token)) {
    return res.status(401).json({ message: "Invalid signature" })
  }

  let event
  try {
    event = parseWebhookEvent(JSON.parse(rawBody.toString("utf8")))
  } catch {
    return res.status(400).json({ message: "Invalid event" })
  }
  if (!event) return res.status(400).json({ message: "Invalid event" })

  try {
    // Deduplication belongs to the persistent engine, not this process.
    await enqueueContentEvent(event.eventId, event.pageIds)
    const result = await reconcileContent({ maintenance: false, revalidate: path => res.revalidate(path) })
    const status = result.failed.length ? "failed" : result.pending.length ? "pending" : "completed"
    return res.status(status === "completed" ? 200 : 503).json({
      status, completed: result.completed, changed: result.changed,
      pending: result.pending.length, failed: result.failed.length, revision: result.revision,
      maintenancePending: result.maintenancePending,
      notificationsPending: result.notificationsPending,
    })
  } catch (error) {
    if (error && typeof error === "object" && "statusCode" in error && error.statusCode === 400) {
      return res.status(400).json({ message: "Invalid event" })
    }
    return res.status(503).json({ status: "failed", message: "Content reconciliation failed" })
  }
}
