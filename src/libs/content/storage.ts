/**
 * Durable content authority, independent of the TTL cache.
 * Configure CONTENT_REDIS_URL (Redis >= 7.2 with AOF enabled), or
 * CONTENT_STATE_DIR on a persistent local filesystem shared by processes in
 * the same host/PID namespace. Redis takes precedence; failures never fall back.
 * Redis saves await local AOF fsync; filesystem saves fsync before atomic rename
 * and fsync the containing directory. Neither backend expires content state.
 * Live filesystem owners never expire. Incomplete/foreign/corrupt lock metadata
 * fails closed and needs operator investigation, not automatic deletion.
 */
import Redis from "ioredis"
import { randomUUID } from "node:crypto"
import {
  closeSync, fsyncSync, linkSync, lstatSync, mkdirSync,
  openSync, readFileSync, readdirSync, renameSync, rmdirSync, unlinkSync,
  writeFileSync,
} from "node:fs"
import { hostname } from "node:os"
import { join, resolve } from "node:path"
import { z } from "zod"
import type { ContentState } from "./types"

// Validate the durable contract without stripping unknown properties or touching
// opaque Notion record-map internals. Persist the original object, not parsed output.
const postEnvelope = z.object({
  id: z.string(), date: z.object({ start_date: z.string() }),
  type: z.array(z.enum(["Post", "Paper", "Page"])), slug: z.string(),
  title: z.string(), status: z.array(z.enum(["Private", "Public", "PublicOnDetail"])),
  createdTime: z.string(), fullWidth: z.boolean(),
  tags: z.array(z.string()).optional(), category: z.array(z.string()).optional(),
  series: z.array(z.string()).optional(), summary: z.string().optional(),
  author: z.array(z.object({ id: z.string(), name: z.string(), profile_photo: z.string().optional() })).optional(),
  lastEditedTime: z.string().optional(), contentHash: z.string().optional(),
  contentModifiedTime: z.string().optional(), thumbnail: z.string().optional(),
})
const stateEnvelope = z.object({
  version: z.literal(1),
  revision: z.number().int().nonnegative(),
  initialized: z.boolean(),
  lastReconciledAt: z.number().finite().nonnegative(),
  lastFullAt: z.number().finite().nonnegative(),
  entries: z.record(z.string(), z.object({
    id: z.string(), lastEdited: z.string(), metadataHash: z.string(),
    bodyCheckedAt: z.number().finite().nonnegative().optional(),
    slugHistory: z.array(z.string()), post: postEnvelope.optional(),
    future: postEnvelope.optional(),
    recordMap: z.record(z.string(), z.unknown()).optional(),
  })),
  pending: z.record(z.string(), z.object({
    attempts: z.number().int().nonnegative(),
    nextAttemptAt: z.number().finite().nonnegative(),
  })),
  events: z.record(z.string(), z.number().finite().nonnegative()),
  effects: z.array(z.object({
    id: z.string(), revision: z.number().int().nonnegative(), paths: z.array(z.string()),
    upserted: z.array(postEnvelope), deletedIds: z.array(z.string()), graphDone: z.boolean(),
  })),
  notifications: z.array(z.object({
    id: z.string(), kind: z.enum(["discord", "indexnow"]), payload: z.array(z.string()),
    attempts: z.number().int().nonnegative(), nextAttemptAt: z.number().finite().nonnegative(),
  })),
})
const ownerEnvelope = z.object({
  token: z.string().uuid(), pid: z.number().int().positive(), host: z.string().min(1),
})
type Owner = { token: string; pid: number; host: string }
type StorageConfig = { kind: "redis"; url: string; prefix: string; leaseMs: number }
  | { kind: "file"; directory: string }
export type ContentLoader = () => Promise<ContentState | null>
export type ContentSaver = (state: ContentState) => Promise<void>
export type ContentOperation<T> = (load: ContentLoader, save: ContentSaver) => Promise<T>
export interface ContentStorage {
  readStoredContent: ContentLoader
  withContentLock<T>(operation: ContentOperation<T>): Promise<T>
}
type Lease = {
  load: ContentLoader
  save: ContentSaver
  release: () => Promise<void>
}
const IO_TIMEOUT_MS = 5000

function unavailable(message: string): Error & { statusCode: number } {
  return Object.assign(new Error(message), { statusCode: 503 })
}
function isCode(error: unknown, code: string): boolean {
  return typeof error === "object" && error !== null && "code" in error && error.code === code
}
function configuration(): StorageConfig {
  const url = process.env.CONTENT_REDIS_URL?.trim()
  if (url) {
    const leaseMs = Number(process.env.CONTENT_LOCK_MS ?? 900000)
    if (!Number.isSafeInteger(leaseMs) || leaseMs < 1000 || leaseMs > 2147483647) {
      throw new Error("CONTENT_LOCK_MS must be an integer between 1000 and 2147483647")
    }
    const namespace = process.env.CONTENT_NAMESPACE?.trim() || "monolog"
    if (/[{}]/.test(namespace)) throw new Error("CONTENT_NAMESPACE cannot contain braces")
    // Distinct from cache namespaces, with a shared hash slot for Redis Cluster Lua.
    return { kind: "redis", url, prefix: `content:{${namespace}}:v1`, leaseMs }
  }
  const directory = process.env.CONTENT_STATE_DIR?.trim()
  if (directory) return { kind: "file", directory: resolve(directory) }
  throw new Error("Durable content storage requires CONTENT_REDIS_URL or a persistent CONTENT_STATE_DIR")
}
function decode(raw: string): ContentState {
  let parsed: unknown
  try { parsed = JSON.parse(raw) } catch { throw new Error("Content state is corrupt: invalid JSON") }
  if (!stateEnvelope.safeParse(parsed).success) {
    throw new Error("Content state is corrupt or has an unsupported version")
  }
  return parsed as ContentState
}
function encode(state: ContentState): string {
  const raw = JSON.stringify(state)
  decode(raw)
  return raw
}

async function connectRedis(config: Extract<StorageConfig, { kind: "redis" }>): Promise<Redis> {
  // A dedicated, explicitly connected client; never use the best-effort TTL cache.
  const client = new Redis(config.url, {
    lazyConnect: true, enableOfflineQueue: false, maxRetriesPerRequest: 0,
    retryStrategy: () => null, connectTimeout: IO_TIMEOUT_MS,
    commandTimeout: IO_TIMEOUT_MS,
  })
  // Transport errors are surfaced by awaited commands, without logging credentials.
  client.on("error", () => undefined)
  try { await client.connect(); return client } catch (error) { client.disconnect(); throw error }
}
async function closeRedis(client: Redis): Promise<void> {
  let timer: NodeJS.Timeout | undefined
  try {
    await Promise.race([
      client.quit(),
      new Promise<void>(resolveClose => {
        timer = setTimeout(() => { client.disconnect(); resolveClose() }, IO_TIMEOUT_MS)
      }),
    ])
  } finally {
    if (timer) clearTimeout(timer)
    client.disconnect()
  }
}
const RENEW = `
if redis.call('GET', KEYS[1]) ~= ARGV[1] then return 0 end
return redis.call('PEXPIRE', KEYS[1], ARGV[2])`
const SAVE = `
if redis.call('GET', KEYS[1]) ~= ARGV[1] then return 0 end
redis.call('SET', KEYS[2], ARGV[2])
redis.call('PEXPIRE', KEYS[1], ARGV[3])
return 1`
const RELEASE = `
if redis.call('GET', KEYS[1]) ~= ARGV[1] then return 0 end
return redis.call('DEL', KEYS[1])`
async function redisLease(config: Extract<StorageConfig, { kind: "redis" }>): Promise<Lease> {
  const client = await connectRedis(config)
  const lockKey = `${config.prefix}:lock`
  const stateKey = `${config.prefix}:state`
  const token = randomUUID()
  try {
    if (await client.set(lockKey, token, "PX", config.leaseMs, "NX") !== "OK") {
      throw unavailable("Content reconciliation is already in progress")
    }
  } catch (error) { await closeRedis(client); throw error }
  let stopped = false
  let lost = false
  let renewal = Promise.resolve()
  // Every renewal is tracked and drained before releasing/closing the connection.
  const timer = setInterval(() => {
    renewal = renewal.then(async () => {
      if (stopped || lost) return
      try {
        if (await client.eval(RENEW, 1, lockKey, token, config.leaseMs) !== 1) lost = true
      } catch { lost = true }
    })
  }, Math.max(100, Math.floor(config.leaseMs / 3)))
  const assertLease = () => {
    if (stopped || lost) throw unavailable("Content storage lease was lost")
  }
  return {
    load: async () => {
      assertLease()
      // Ownership and the state read share one atomic Redis operation.
      const raw = await client.eval(
        "if redis.call('GET', KEYS[1]) ~= ARGV[1] then return {0} end return {1, redis.call('GET', KEYS[2])}",
        2, lockKey, stateKey, token,
      )
      if (!Array.isArray(raw) || raw[0] !== 1) throw unavailable("Content storage lease was lost")
      return typeof raw[1] === "string" ? decode(raw[1]) : null
    },
    save: async state => {
      assertLease()
      // Fencing and SET happen in the same script, so an expired owner cannot save.
      if (await client.eval(SAVE, 2, lockKey, stateKey, token, encode(state), config.leaseMs) !== 1) {
        lost = true
        throw unavailable("Content storage lease was lost before saving")
      }
      // Redis 7.2+ WAITAOF fences acknowledgement on local AOF fsync, not merely
      // a successful in-memory SET. Disabled AOF/older Redis is a hard failure.
      const durable = await client.call("WAITAOF", "1", "0", String(IO_TIMEOUT_MS - 1000))
      if (!Array.isArray(durable) || durable[0] !== 1) {
        throw unavailable("Content Redis save was not durably fsynced; enable AOF on Redis 7.2 or newer")
      }
    },
    release: async () => {
      stopped = true
      clearInterval(timer)
      await renewal
      try { await client.eval(RELEASE, 1, lockKey, token) } finally { await closeRedis(client) }
    },
  }
}

function readFileState(directory: string): ContentState | null {
  // ENOENT of the state file alone is a missing baseline. EACCES, EIO, and bad
  // JSON must reach the caller, never trigger a destructive reinitialization.
  let raw: string
  try { raw = readFileSync(join(directory, "state.json"), "utf8") } catch (error) {
    if (isCode(error, "ENOENT")) {
      // A disappeared volume/directory is unavailable, not an empty baseline.
      if (!lstatSync(directory).isDirectory()) throw new Error("CONTENT_STATE_DIR is not a directory")
      return null
    }
    throw error
  }
  return decode(raw)
}
function syncDirectory(directory: string): void {
  const descriptor = openSync(directory, "r")
  try { fsyncSync(descriptor) } finally { closeSync(descriptor) }
}
function writeSynced(path: string, raw: string): void {
  const descriptor = openSync(path, "wx", 0o600)
  try { writeFileSync(descriptor, raw, "utf8"); fsyncSync(descriptor) } finally { closeSync(descriptor) }
}
function unlinkMissingAllowed(path: string): void {
  try { unlinkSync(path) } catch (error) { if (!isCode(error, "ENOENT")) throw error }
}
function removeEmptyLock(path: string): void {
  // NEVER recursively delete or rename a lock: a successor may already own it.
  // A successor's unique owner file makes rmdir fail rather than stealing it.
  try { rmdirSync(path) } catch (error) {
    if (!isCode(error, "ENOENT") && !isCode(error, "ENOTEMPTY") && !isCode(error, "EEXIST")) throw error
  }
}
function readOwner(lock: string): { file: string; owner: Owner } | null {
  let files: string[]
  try { files = readdirSync(lock) } catch (error) {
    if (isCode(error, "ENOENT")) return null
    throw error
  }
  // An initializing, interrupted, or contested lock is not safe to reclaim.
  if (files.length !== 1) return null
  const file = files[0]
  let raw: string
  try { raw = readFileSync(join(lock, file), "utf8") } catch (error) {
    if (isCode(error, "ENOENT")) return null
    throw error
  }
  let parsed: unknown
  try { parsed = JSON.parse(raw) } catch { throw new Error("Content lock ownership metadata is corrupt") }
  const result = ownerEnvelope.safeParse(parsed)
  if (!result.success || file !== `owner-${result.data.token}.json`) {
    throw new Error("Content lock ownership metadata is corrupt")
  }
  return { file, owner: result.data }
}
function recoverDeadOwner(lock: string): boolean {
  const candidate = readOwner(lock)
  if (!candidate || candidate.owner.host !== hostname()) return false
  // Filesystem mode requires a local persistent volume and a shared PID namespace.
  // Age is NEVER proof of abandonment: a paused/live process keeps its lock.
  try { process.kill(candidate.owner.pid, 0); return false } catch (error) {
    if (!isCode(error, "ESRCH")) return false
  }
  const current = readOwner(lock)
  if (!current || current.owner.token !== candidate.owner.token) return false
  // Unique filenames fence multiple reapers; only the proven-dead owner's file
  // can be unlinked. rmdir is atomic and cannot remove an initialized successor.
  unlinkMissingAllowed(join(lock, candidate.file))
  removeEmptyLock(lock)
  return true
}
async function fileLease(directory: string): Promise<Lease> {
  mkdirSync(directory, { recursive: true, mode: 0o700 })
  const lock = join(directory, "operation.lock")
  const owner: Owner = { token: randomUUID(), pid: process.pid, host: hostname() }
  const file = `owner-${owner.token}.json`
  let acquired = false
  try { mkdirSync(lock, { mode: 0o700 }); acquired = true } catch (error) {
    if (!isCode(error, "EEXIST")) throw error
    if (recoverDeadOwner(lock)) {
      try { mkdirSync(lock, { mode: 0o700 }); acquired = true } catch (retryError) {
        if (!isCode(retryError, "EEXIST")) throw retryError
      }
    }
  }
  if (!acquired) throw unavailable("Content reconciliation is already in progress or its filesystem lock cannot safely be recovered")
  const prepared = join(directory, `.owner-${owner.token}.tmp`)
  try {
    writeSynced(prepared, JSON.stringify(owner))
    // Publish complete ownership metadata atomically; a reader never sees partial JSON.
    linkSync(prepared, join(lock, file))
    syncDirectory(lock)
  } catch (error) {
    unlinkMissingAllowed(join(lock, file))
    removeEmptyLock(lock)
    throw error
  } finally { unlinkMissingAllowed(prepared) }
  const identity = lstatSync(lock, { bigint: true })
  let released = false
  const assertLease = () => {
    if (released) throw unavailable("Content filesystem lock was released")
    let currentIdentity: typeof identity
    try { currentIdentity = lstatSync(lock, { bigint: true }) } catch (error) {
      if (isCode(error, "ENOENT")) throw unavailable("Content filesystem lock was lost")
      throw error
    }
    const current = readOwner(lock)
    if (!currentIdentity.isDirectory() || currentIdentity.ino !== identity.ino
      || currentIdentity.dev !== identity.dev || current?.owner.token !== owner.token) {
      throw unavailable("Content filesystem lock ownership was lost")
    }
  }
  try { assertLease() } catch (error) {
    unlinkMissingAllowed(join(lock, file)); removeEmptyLock(lock); throw error
  }
  return {
    load: async () => { assertLease(); return readFileState(directory) },
    save: async state => {
      assertLease()
      const temporary = join(directory, `.state-${owner.token}-${randomUUID()}.tmp`)
      try {
        writeSynced(temporary, encode(state))
        // No await between fencing and rename. Live owners are never age-expired.
        assertLease()
        renameSync(temporary, join(directory, "state.json"))
        syncDirectory(directory)
      } finally { unlinkMissingAllowed(temporary) }
    },
    release: async () => {
      if (released) return
      released = true
      unlinkMissingAllowed(join(lock, file))
      removeEmptyLock(lock)
      syncDirectory(directory)
    },
  }
}

/** A lock-free atomic snapshot read. Missing state is null; unavailable/corrupt state throws. */
export async function readStoredContent(): Promise<ContentState | null> {
  const config = configuration()
  if (config.kind === "file") {
    // Creating an explicitly configured volume's directory is allowed; failure
    // to create/access it must throw rather than become a missing baseline.
    mkdirSync(config.directory, { recursive: true, mode: 0o700 })
    const directory = lstatSync(config.directory)
    if (!directory.isDirectory()) throw new Error("CONTENT_STATE_DIR is not a directory")
    return readFileState(config.directory)
  }
  const client = await connectRedis(config)
  try {
    const raw = await client.get(`${config.prefix}:state`)
    return raw === null ? null : decode(raw)
  } finally { await closeRedis(client) }
}

/** All content mutations must await load/save inside this global operation lock. */
export async function withContentLock<T>(
  fn: ContentOperation<T>,
): Promise<T> {
  const config = configuration()
  const lease = config.kind === "redis" ? await redisLease(config) : await fileLease(config.directory)
  let active = true
  let pending = Promise.resolve()
  const operation = <R>(run: () => Promise<R>): Promise<R> => {
    if (!active) return Promise.reject(unavailable("Content operation has already finished"))
    const result = pending.then(() => {
      if (!active) throw unavailable("Content operation has already finished")
      return run()
    })
    pending = result.then(() => undefined, () => undefined)
    return result
  }
  try {
    return await fn(() => operation(lease.load), state => operation(() => lease.save(state)))
  } finally {
    active = false
    await pending
    await lease.release()
  }
}
