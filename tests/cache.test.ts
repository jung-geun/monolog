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

