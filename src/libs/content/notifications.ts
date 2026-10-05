import type { ContentNotification, ContentState } from "./types"
import { contentDigest } from "./hash"
import { absoluteUrl } from "src/libs/seo"

const MAX_NOTIFICATION_ATTEMPTS = 8
type DeliveryResult = "delivered" | "permanent-failure" | "transient-failure"

export function queueValidationWarning(state: ContentState, pageId: string, code: string): void {
  if (!process.env.DISCORD_WEBHOOK) return
  const payload = [`Content validation rejected page ${pageId}: ${code}. Check raw Status, Type, Slug and publication date.`]
  const id = contentDigest(["discord", pageId, code])
  if (!state.notifications.some(item => item.id === id)) state.notifications.push({ id, kind: "discord", payload, attempts: 0, nextAttemptAt: 0 })
}
export function queueIndexNow(state: ContentState, paths: string[]): void {
  if (!process.env.INDEXNOW_KEY || paths.length === 0) return
  const payload = [...new Set(paths)]
  const id = contentDigest(["indexnow", payload, state.revision])
  state.notifications.push({ id, kind: "indexnow", payload, attempts: 0, nextAttemptAt: 0 })
}
async function deliver(item: ContentNotification): Promise<DeliveryResult> {
  let endpoint: string
  let body: unknown
  // Invalid or removed configuration cannot recover by retrying this delivery.
  try {
    if (item.kind === "discord") {
      const configured = process.env.DISCORD_WEBHOOK
      if (!configured) return "permanent-failure"
      const url = new URL(configured)
      if (url.protocol !== "https:" || !["discord.com", "discordapp.com"].includes(url.hostname) || !url.pathname.startsWith("/api/webhooks/")) return "permanent-failure"
      endpoint = url.href
      body = { content: item.payload.join("\n").slice(0, 1800), allowed_mentions: { parse: [] } }
    } else {
      const key = process.env.INDEXNOW_KEY
      if (!key || !/^[a-fA-F0-9]{8,128}$/.test(key)) return "permanent-failure"
      const site = new URL(absoluteUrl("/"))
      if (site.username || site.password) return "permanent-failure"
      const urlList = item.payload.map(absoluteUrl)
      if (urlList.some(url => new URL(url).origin !== site.origin)) return "permanent-failure"
      const keyLocation = process.env.INDEXNOW_KEY_LOCATION || absoluteUrl(`/${key}.txt`)
      if (new URL(keyLocation).origin !== site.origin) return "permanent-failure"
      endpoint = "https://api.indexnow.org/indexnow"
      body = { host: site.hostname, key, keyLocation, urlList }
    }
  } catch {
    return "permanent-failure"
  }
  try {
    const response = await fetch(endpoint, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body), signal: AbortSignal.timeout(5000), redirect: "error",
    })
    if (response.ok) return "delivered"
    return response.status >= 400 && response.status < 500 && response.status !== 429
      ? "permanent-failure" : "transient-failure"
  } catch {
    return "transient-failure"
  }
}
/** Returns transient delivery identifiers for diagnostics, never content health failures. */
export async function drainNotifications(state: ContentState, save: (state: ContentState) => Promise<void>): Promise<string[]> {
  const failed: string[] = []
  // Five deliveries per request; retries stay durable but stop after eight attempts.
  for (const item of state.notifications.filter(candidate => candidate.nextAttemptAt <= Date.now()).slice(0, 5)) {
    if (item.attempts >= MAX_NOTIFICATION_ATTEMPTS) {
      state.notifications = state.notifications.filter(candidate => candidate.id !== item.id)
      console.warn(`Content notification (${item.kind}) dropped: attempt limit reached`)
      await save(state)
      continue
    }
    const result = await deliver(item)
    if (result === "delivered") {
      state.notifications = state.notifications.filter(candidate => candidate.id !== item.id)
    } else {
      item.attempts += 1
      const retry = result === "transient-failure" && item.attempts < MAX_NOTIFICATION_ATTEMPTS
      if (retry) {
        item.nextAttemptAt = Date.now() + Math.min(3600000, 15000 * 2 ** Math.min(item.attempts, 8))
      } else {
        state.notifications = state.notifications.filter(candidate => candidate.id !== item.id)
      }
      if (result === "transient-failure") failed.push(`notification:${item.kind}:${item.id.slice(0, 12)}`)
      // Never log request URLs, payloads, responses or exception messages: they may contain secrets.
      console.warn(`Content notification (${item.kind}) ${retry ? "retry scheduled" : "dropped"}: ${result === "permanent-failure" ? "permanent failure" : retry ? "transient failure" : "attempt limit reached"}`)
    }
    await save(state)
  }
  return failed
}
