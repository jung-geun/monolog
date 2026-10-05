/**
 * @jest-environment node
 */

jest.mock("site.config", () => ({ CONFIG: { link: "https://canonical.example/" } }))

import { absoluteUrl } from "src/libs/seo"
import { drainNotifications, queueIndexNow, queueValidationWarning } from "src/libs/content/notifications"
import { emptyContentState, type ContentNotification, type ContentState } from "src/libs/content/types"

const NOW = Date.parse("2026-06-01T12:00:00Z")
const WEBHOOK = "https://discord.com/api/webhooks/123/private-webhook-token"
const KEY = "abcdef0123456789"
const PAYLOAD = "private notification payload"
const envKeys = ["DISCORD_WEBHOOK", "INDEXNOW_KEY", "INDEXNOW_KEY_LOCATION", "NEXT_PUBLIC_SITE_URL"] as const
let savedEnv: Partial<Record<(typeof envKeys)[number], string>>
let fetchMock: jest.SpiedFunction<typeof fetch>
let warn: jest.SpiedFunction<typeof console.warn>
let state: ContentState
let persisted: ContentState[]
let save: jest.Mock<Promise<void>, [ContentState]>

function enqueue(kind: ContentNotification["kind"]): ContentNotification {
  if (kind === "discord") queueValidationWarning(state, "private-page-id", "private-validation-code")
  else queueIndexNow(state, ["/post", "/post.md"])
  const item = state.notifications[state.notifications.length - 1]
  if (kind === "discord") item.payload = [PAYLOAD]
  return item
}

beforeEach(() => {
  savedEnv = {}
  for (const key of envKeys) {
    savedEnv[key] = process.env[key]
    delete process.env[key]
  }
  process.env.DISCORD_WEBHOOK = WEBHOOK
  process.env.INDEXNOW_KEY = KEY
  jest.useFakeTimers({ now: NOW })
  fetchMock = jest.spyOn(globalThis, "fetch").mockResolvedValue(new Response(null, { status: 204 }))
  warn = jest.spyOn(console, "warn").mockImplementation(() => {})
  state = emptyContentState()
  persisted = []
  save = jest.fn(async current => { persisted.push(JSON.parse(JSON.stringify(current))) })
})

afterEach(() => {
  jest.restoreAllMocks()
  jest.useRealTimers()
  for (const key of envKeys) {
    const value = savedEnv[key]
    if (value === undefined) delete process.env[key]
    else process.env[key] = value
  }
})

describe("optional content notification delivery", () => {
  it.each(["discord", "indexnow"] as const)("removes and saves successful %s deliveries", async kind => {
    enqueue(kind)
    expect(await drainNotifications(state, save)).toEqual([])
    expect(state.notifications).toEqual([])
    expect(persisted.map(current => current.notifications)).toEqual([[]])
    expect(warn).not.toHaveBeenCalled()
    if (kind === "discord") {
      expect(fetchMock.mock.calls[0][0]).toBe(WEBHOOK)
      expect(JSON.parse(String(fetchMock.mock.calls[0][1]?.body))).toEqual({
        content: PAYLOAD, allowed_mentions: { parse: [] },
      })
    }
  })

  it.each([undefined, "https://wrong-env.example"])("delivers IndexNow using SEO's canonical origin with site env %s", async siteEnv => {
    if (siteEnv !== undefined) process.env.NEXT_PUBLIC_SITE_URL = siteEnv
    queueIndexNow(state, ["/post", "/post", "/post.md", "/tags/a%20b"])
    expect(state.notifications[0].payload).toEqual(["/post", "/post.md", "/tags/a%20b"])
    fetchMock.mockResolvedValue(new Response(null, { status: 202 }))
    expect(await drainNotifications(state, save)).toEqual([])
    expect(fetchMock.mock.calls[0][0]).toBe("https://api.indexnow.org/indexnow")
    const body = JSON.parse(String(fetchMock.mock.calls[0][1]?.body))
    expect(body).toEqual({
      host: "canonical.example",
      key: KEY,
      keyLocation: absoluteUrl(`/${KEY}.txt`),
      urlList: [absoluteUrl("/post"), absoluteUrl("/post.md"), absoluteUrl("/tags/a%20b")],
    })
    expect(new URL(body.keyLocation).origin).toBe(new URL(absoluteUrl("/")).origin)
    expect(state.notifications).toEqual([])
    expect(persisted[0].notifications).toEqual([])
  })

  it("delivers with a custom key location on the canonical origin", async () => {
    process.env.INDEXNOW_KEY_LOCATION = absoluteUrl("/keys/indexnow.txt")
    enqueue("indexnow")
    await drainNotifications(state, save)
    expect(JSON.parse(String(fetchMock.mock.calls[0][1]?.body)).keyLocation).toBe(absoluteUrl("/keys/indexnow.txt"))
    expect(state.notifications).toEqual([])
  })

  it.each(["discord", "indexnow"] as const)("drops non-429 4xx %s deliveries durably", async kind => {
    for (const status of [400, 401, 403, 404, 408, 410, 422]) {
      enqueue(kind)
      fetchMock.mockResolvedValue(new Response("private response body", { status }))
      expect(await drainNotifications(state, save)).toEqual([])
      expect(state.notifications).toEqual([])
      expect(persisted[persisted.length - 1].notifications).toEqual([])
      const delivered = fetchMock.mock.calls.length
      await drainNotifications(state, save)
      expect(fetchMock).toHaveBeenCalledTimes(delivered)
    }
    expect(warn).toHaveBeenCalledTimes(7)
  })

  it.each(["discord", "indexnow"] as const)("drops %s when its configuration is removed after enqueue", async kind => {
    enqueue(kind)
    delete process.env[kind === "discord" ? "DISCORD_WEBHOOK" : "INDEXNOW_KEY"]
    expect(await drainNotifications(state, save)).toEqual([])
    expect(fetchMock).not.toHaveBeenCalled()
    expect(state.notifications).toEqual([])
    expect(persisted[0].notifications).toEqual([])
    expect(warn).toHaveBeenCalledTimes(1)
  })

  it.each([
    ["discord", "DISCORD_WEBHOOK", "malformed-secret-endpoint"],
    ["discord", "DISCORD_WEBHOOK", "https://wrong-host.example/api/webhooks/private-token"],
    ["indexnow", "INDEXNOW_KEY", "invalid-secret-key"],
    ["indexnow", "INDEXNOW_KEY_LOCATION", "https://wrong-host.example/private-key.txt"],
    ["indexnow", "INDEXNOW_KEY_LOCATION", "malformed-secret-location"],
  ] as const)("drops invalid %s configuration in %s", async (kind, key, value) => {
    enqueue(kind)
    process.env[key] = value
    expect(await drainNotifications(state, save)).toEqual([])
    expect(fetchMock).not.toHaveBeenCalled()
    expect(state.notifications).toEqual([])
    expect(persisted[0].notifications).toEqual([])
    expect(JSON.stringify(warn.mock.calls)).not.toContain(value)
  })

  it.each(["https://foreign.example/post", "//foreign.example/post", "mailto:private@example.com"])("drops off-origin IndexNow payload %s", async path => {
    queueIndexNow(state, [path])
    expect(await drainNotifications(state, save)).toEqual([])
    expect(fetchMock).not.toHaveBeenCalled()
    expect(state.notifications).toEqual([])
    expect(persisted[0].notifications).toEqual([])
  })

  describe.each(["discord", "indexnow"] as const)("bounded %s retries", kind => {
    it.each([429, 500, 503, "network", "timeout"] as const)("retries %s only until the eighth attempt", async failure => {
      const item = enqueue(kind)
      if (typeof failure === "number") fetchMock.mockResolvedValue(new Response(null, { status: failure }))
      else fetchMock.mockRejectedValue(new Error(`${failure}: ${WEBHOOK} ${KEY} ${PAYLOAD}`))
      const identifier = `notification:${kind}:${item.id.slice(0, 12)}`
      for (let attempt = 1; attempt <= 8; attempt++) {
        const attemptedAt = Date.now()
        expect(await drainNotifications(state, save)).toEqual([identifier])
        expect(item.attempts).toBe(attempt)
        expect(fetchMock).toHaveBeenCalledTimes(attempt)
        expect(persisted).toHaveLength(attempt)
        if (attempt < 8) {
          expect(item.nextAttemptAt).toBe(attemptedAt + Math.min(3600000, 15000 * 2 ** attempt))
          expect(persisted[attempt - 1].notifications).toEqual([item])
          jest.setSystemTime(item.nextAttemptAt - 1)
          expect(await drainNotifications(state, save)).toEqual([])
          expect(fetchMock).toHaveBeenCalledTimes(attempt)
          expect(persisted).toHaveLength(attempt)
          jest.setSystemTime(item.nextAttemptAt)
        } else {
          expect(state.notifications).toEqual([])
          expect(persisted[attempt - 1].notifications).toEqual([])
        }
      }
      jest.setSystemTime(Date.now() + 86400000)
      expect(await drainNotifications(state, save)).toEqual([])
      expect(fetchMock).toHaveBeenCalledTimes(8)
      expect(warn).toHaveBeenCalledTimes(8)
      const logs = JSON.stringify(warn.mock.calls)
      for (const secret of [WEBHOOK, "private-webhook-token", KEY, PAYLOAD, "private-page-id", "private-validation-code"]) {
        expect(logs).not.toContain(secret)
      }
      expect(logs).toContain("attempt limit reached")
    })

    it("can successfully deliver a persisted transient retry", async () => {
      enqueue(kind)
      fetchMock.mockRejectedValueOnce(new Error("network unavailable"))
      await drainNotifications(state, save)
      state = JSON.parse(JSON.stringify(persisted[0]))
      jest.setSystemTime(state.notifications[0].nextAttemptAt)
      expect(await drainNotifications(state, save)).toEqual([])
      expect(state.notifications).toEqual([])
      expect(persisted[1].notifications).toEqual([])
      expect(fetchMock).toHaveBeenCalledTimes(2)
    })

    it("discards an already exhausted durable entry without another request", async () => {
      enqueue(kind).attempts = 8
      expect(await drainNotifications(state, save)).toEqual([])
      expect(fetchMock).not.toHaveBeenCalled()
      expect(state.notifications).toEqual([])
      expect(persisted[0].notifications).toEqual([])
    })
  })

  it("leaves future entries untouched and limits each drain to five due deliveries", async () => {
    const future = enqueue("discord")
    future.nextAttemptAt = NOW + 60000
    for (let i = 0; i < 6; i++) queueIndexNow(state, [`/post-${i}`])
    expect(await drainNotifications(state, save)).toEqual([])
    expect(fetchMock).toHaveBeenCalledTimes(5)
    expect(persisted.map(current => current.notifications.length)).toEqual([6, 5, 4, 3, 2])
    expect(state.notifications.map(item => item.payload)).toEqual([[PAYLOAD], ["/post-5"]])
    await drainNotifications(state, save)
    expect(fetchMock).toHaveBeenCalledTimes(6)
    expect(state.notifications).toEqual([future])
  })

  it("propagates save failures and stops before another delivery", async () => {
    enqueue("discord")
    enqueue("indexnow")
    save.mockRejectedValueOnce(new Error("durability unavailable"))
    await expect(drainNotifications(state, save)).rejects.toThrow("durability unavailable")
    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(state.notifications.map(item => item.kind)).toEqual(["indexnow"])
  })
})
