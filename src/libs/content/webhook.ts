import { createHmac, timingSafeEqual } from "crypto"

export const MAX_WEBHOOK_BODY_BYTES = 1024 * 1024

export type ContentWebhookEvent = {
  eventId: string
  pageIds: string[]
}

/** Verify the signature over the original bytes, before parsing any JSON. */
export function verifyWebhookSignature(
  body: Buffer,
  signature: string | string[] | undefined,
  token: string
): boolean {
  if (!token || typeof signature !== "string") return false
  const match = /^sha256=([a-fA-F0-9]{64})$/.exec(signature)
  if (!match) return false
  const expected = createHmac("sha256", token).update(body).digest()
  const supplied = Buffer.from(match[1], "hex")
  return timingSafeEqual(expected, supplied)
}

function object(value: unknown): Record<string, unknown> | undefined {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : undefined
}

/** Notion's unsigned subscription handshake carries only its signing secret. */
export function parseVerificationRequest(value: unknown): string | null {
  const body = object(value)
  if (!body || Object.keys(body).length !== 1) return null
  const token = body.verification_token
  return typeof token === "string" && /^secret_[A-Za-z0-9]{16,256}$/.test(token) ? token : null
}

/** Events supply invalidation hints only; the engine retrieves live metadata. */
export function parseWebhookEvent(value: unknown): ContentWebhookEvent | null {
  const event = object(value)
  if (!event || "verification_token" in event || typeof event.id !== "string" || !event.id.trim()) {
    return null
  }

  const pageIds = new Set<string>()
  const add = (id: unknown) => {
    if (typeof id === "string" && id.trim()) pageIds.add(id.trim())
  }
  const entity = object(event.entity)
  const data = object(event.data)
  if (entity?.type === "page") add(entity.id)
  add(data?.page_id)
  if (Array.isArray(data?.page_ids)) data.page_ids.forEach(add)

  if (entity?.type === "block") {
    for (const parent of [object(entity.parent), object(data?.parent)]) {
      if (!parent) continue
      add(parent.page_id)
      if (parent.type === "page" || parent.type === "page_id") add(parent.id)
    }
  }

  return { eventId: event.id.trim(), pageIds: [...pageIds] }
}
