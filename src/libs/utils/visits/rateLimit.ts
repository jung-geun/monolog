import { LRUCache } from "lru-cache"

const visitStore = new LRUCache<string, { count: number; start: number }>({
  max: 50_000,
  ttl: 60_000,
})

const VISITS_PER_MIN = 60
const WINDOW_MS = 60_000

export function checkVisitRateLimit(ipHash: string): { ok: boolean } {
  const now = Date.now()
  const entry = visitStore.get(ipHash)

  if (!entry || now - entry.start >= WINDOW_MS) {
    visitStore.set(ipHash, { count: 1, start: now })
    return { ok: true }
  }

  if (entry.count >= VISITS_PER_MIN) return { ok: false }

  visitStore.set(ipHash, { count: entry.count + 1, start: entry.start })
  return { ok: true }
}
