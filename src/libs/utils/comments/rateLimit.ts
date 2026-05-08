import { LRUCache } from "lru-cache"

type Counter = {
  lastPost: number
  minCount: number
  minStart: number
  hourCount: number
  hourStart: number
}

const store = new LRUCache<string, Counter>({
  max: 10_000,
  ttl: 3_600_000,
})

const COOLDOWN_MS = 60_000
const BURST_PER_MIN = 3
const HOURLY = 20

// GET rate limit: separate store, no cooldown, just per-minute cap
const getStore = new LRUCache<string, { count: number; start: number }>({
  max: 20_000,
  ttl: 60_000,
})
const GET_BURST_PER_MIN = 30

export function checkGetRateLimit(ipHash: string): { ok: boolean } {
  const now = Date.now()
  const entry = getStore.get(ipHash)
  if (!entry || now - entry.start >= 60_000) {
    getStore.set(ipHash, { count: 1, start: now })
    return { ok: true }
  }
  if (entry.count >= GET_BURST_PER_MIN) return { ok: false }
  getStore.set(ipHash, { count: entry.count + 1, start: entry.start })
  return { ok: true }
}

export function inspectRateLimit(ipHash: string): { ok: boolean; reason?: string } {
  const now = Date.now()
  const entry = store.get(ipHash) ?? {
    lastPost: 0,
    minCount: 0,
    minStart: now,
    hourCount: 0,
    hourStart: now,
  }

  if (now - entry.lastPost < COOLDOWN_MS) return { ok: false, reason: "cooldown" }

  const minActive = now - entry.minStart < 60_000
  if (minActive && entry.minCount >= BURST_PER_MIN) return { ok: false, reason: "burst" }

  const hourActive = now - entry.hourStart < 3_600_000
  if (hourActive && entry.hourCount >= HOURLY) return { ok: false, reason: "hourly" }

  return { ok: true }
}

export function commitRateLimit(ipHash: string): void {
  const now = Date.now()
  const entry = store.get(ipHash) ?? {
    lastPost: 0,
    minCount: 0,
    minStart: now,
    hourCount: 0,
    hourStart: now,
  }

  const minActive = now - entry.minStart < 60_000
  const minCount = minActive ? entry.minCount : 0
  const minStart = minActive ? entry.minStart : now

  const hourActive = now - entry.hourStart < 3_600_000
  const hourCount = hourActive ? entry.hourCount : 0
  const hourStart = hourActive ? entry.hourStart : now

  store.set(ipHash, {
    lastPost: now,
    minCount: minCount + 1,
    minStart,
    hourCount: hourCount + 1,
    hourStart,
  })
}
