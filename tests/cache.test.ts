/**
 * @jest-environment node
 */
import { MemoryBackend } from "src/libs/cache/MemoryBackend"

describe("MemoryBackend", () => {
  it("stores and retrieves a value", async () => {
    const backend = new MemoryBackend()
    await backend.set("key1", { hello: "world" }, 5000)
    const result = await backend.get<{ hello: string }>("key1")
    expect(result).toEqual({ hello: "world" })
  })

  it("returns null for missing key", async () => {
    const backend = new MemoryBackend()
    expect(await backend.get("missing")).toBeNull()
  })

  it("returns null after TTL expires", async () => {
    const backend = new MemoryBackend()
    await backend.set("expiring", 42, 1) // 1ms TTL
    await new Promise((r) => setTimeout(r, 10))
    expect(await backend.get("expiring")).toBeNull()
  })

  it("deletes a key", async () => {
    const backend = new MemoryBackend()
    await backend.set("k", "v", 5000)
    await backend.delete("k")
    expect(await backend.get("k")).toBeNull()
  })

  it("clears all keys", async () => {
    const backend = new MemoryBackend()
    await backend.set("a", 1, 5000)
    await backend.set("b", 2, 5000)
    await backend.clear()
    expect(await backend.get("a")).toBeNull()
    expect(await backend.get("b")).toBeNull()
  })

  it("clears only keys with matching prefix", async () => {
    const backend = new MemoryBackend()
    await backend.set("posts:abc", 1, 5000)
    await backend.set("recordMap:def", 2, 5000)
    await backend.clear("posts")
    expect(await backend.get("posts:abc")).toBeNull()
    expect(await backend.get("recordMap:def")).toBe(2)
  })

  it("evicts oldest entry when at MAX_ENTRIES capacity", async () => {
    const backend = new MemoryBackend()
    // Fill 200 entries (MAX_ENTRIES)
    for (let i = 0; i < 200; i++) {
      await backend.set(`key-${i}`, i, 60_000)
    }
    // Adding one more should evict the first
    await backend.set("key-200", 200, 60_000)
    // key-0 should be evicted
    expect(await backend.get("key-0")).toBeNull()
    expect(await backend.get("key-200")).toBe(200)
  })
})

describe("cache keys", () => {
  const { keys } = require("src/libs/cache/keys")

  it("generates stable posts key", () => {
    expect(keys.posts("abc123")).toBe("posts:v2:abc123")
  })

  it("generates stable recordMap key including lastEdited", () => {
    // RM_VERSION prefix introduced so convertRichText / processBlock shape
    // changes invalidate stale recordMap caches. Bumped through several
    // versions during the Notion block coverage releases; current is v6.
    const k = keys.recordMap("page-id", "2026-01-01T00:00:00.000Z")
    expect(k).toBe("recordMap:v6:page-id:2026-01-01T00:00:00.000Z")
  })

  it("generates distinct keys for different lastEdited", () => {
    const k1 = keys.recordMap("page-id", "2026-01-01T00:00:00.000Z")
    const k2 = keys.recordMap("page-id", "2026-04-01T00:00:00.000Z")
    expect(k1).not.toBe(k2)
  })
})
