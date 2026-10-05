import { createHash } from "crypto"
import { getPosts } from "src/apis/notion-client/getPosts"
import { cacheStore, keys } from "src/libs/cache"
import { extractPostOntology } from "./extractPostOntology"
import { extractRelations } from "./extractRelations"
import { searchSimilar, normalizeUUID, deletePoint, updatePostPayload } from "src/apis/vector/qdrantClient"
import { TPost } from "src/types"
import type { Ontology, OntologyState, PostOntology, Entity } from "src/types/ontology"
import { debugLog, warnLog } from "src/libs/utils/logger"
import { eligibleGraphPosts, postContentVersion } from "src/apis/notion-client/graphHash"
import type { SimilarResult } from "src/apis/vector/qdrantClient"

// The incremental index must never expire in a quiet blog; expiry would force a full LLM rebuild.
const ONTOLOGY_STATE_TTL_MS = 0
const SIMILARITY_THRESHOLD = 0.85
const TOP_K = 8

export type BuildStats = {
  added: number
  modified: number
  removed: number
  stateSizeBytes: number
}

function emptyState(): OntologyState {
  return { version: "v2", generatedAt: new Date().toISOString(), entities: [], edges: [], index: {} }
}

function toOntology(state: OntologyState): Ontology {
  return {
    version: state.version,
    generatedAt: state.generatedAt,
    entities: state.entities,
    edges: state.edges,
  }
}

function computeDiff(
  index: Record<string, string>,
  posts: TPost[]
): { added: TPost[]; modified: TPost[]; removed: string[] } {
  const currentIds = new Set(posts.map((p) => p.id))
  const removed = Object.keys(index).filter((id) => !currentIds.has(id))
  const added: TPost[] = []
  const modified: TPost[] = []
  for (const post of posts) {
    const lastEdited = postContentVersion(post)
    if (!(post.id in index)) added.push(post)
    else if (index[post.id] !== lastEdited && !(post.contentHash && index[post.id] === post.lastEditedTime)) modified.push(post)
  }
  return { added, modified, removed }
}

function normalizeEntityName(name: string): string {
  return name.trim().toLowerCase()
}

function mergeEntityIntoState(state: OntologyState, postId: string, raw: Omit<Entity, "id" | "postIds">): void {
  const norm = normalizeEntityName(raw.name)
  const id = createHash("sha1").update(`entity:${norm}`).digest("hex").slice(0, 16)
  const existing = state.entities.find((e) => e.id === id)
  if (existing) {
    if (!existing.postIds.includes(postId)) existing.postIds.push(postId)
    for (const alias of raw.aliases ?? []) {
      if (!existing.aliases.includes(alias)) existing.aliases.push(alias)
    }
  } else {
    state.entities.push({
      id,
      kind: raw.kind,
      name: raw.name,
      aliases: raw.aliases ?? [],
      description: raw.description,
      postIds: [postId],
    })
  }
}

function removePostFromState(state: OntologyState, postId: string): void {
  state.edges = state.edges.filter((e) => e.source !== postId && e.target !== postId)
  for (const entity of state.entities) {
    entity.postIds = entity.postIds.filter((id) => id !== postId)
  }
  state.entities = state.entities.filter((e) => e.postIds.length > 0)
  delete state.index[postId]
}

async function addPostToState(
  state: OntologyState,
  post: TPost,
  postMap: Map<string, TPost>,
  opts: OntologyRefreshOptions
): Promise<void> {
  const lastEdited = postContentVersion(post)

  // entity 추출 + 임베딩 + Qdrant upsert (캐시 히트면 LLM 스킵)
  const ont = await extractPostOntology(post, opts)

  // 벡터 검색으로 기존 그래프 내 후보 추출
  const vector = await cacheStore.get<number[]>(keys.embedding(post.id, lastEdited))
  const candidates: TPost[] = []

  if (vector) {
    let similar: SimilarResult[] = []
    try {
      similar = await searchSimilar(vector, TOP_K, normalizeUUID(post.id))
    } catch (err) {
      warnLog(`[addPostToState] Qdrant search failed for "${post.slug}":`, err)
      throw err
    }

    for (const result of similar) {
      // 아직 index에 없는 페이지(동시에 추가 중인 페이지)는 제외 — 그쪽 처리 시 역방향으로 연결됨
      if (result.postId === post.id || !(result.postId in state.index)) continue
      const targetPost = postMap.get(result.postId)
      if (!targetPost) continue
      candidates.push(targetPost)
      if (result.score >= SIMILARITY_THRESHOLD) {
        const alreadyLinked = state.edges.some(
          (e) =>
            e.kind === "similar-topic" &&
            ((e.source === post.id && e.target === result.postId) ||
              (e.source === result.postId && e.target === post.id))
        )
        if (!alreadyLinked) {
          state.edges.push({
            source: post.id,
            target: result.postId,
            kind: "similar-topic",
            confidence: result.score,
          })
        }
      }
    }
  }

  // 양방향 의미 관계 (prerequisite, elaborates 등 방향성 있는 관계 누락 방지)
  if (candidates.length > 0) {
    const summaries = new Map<string, string>([[post.id, ont.summary]])
    for (const candidate of candidates) {
      const cLastEdited = postContentVersion(candidate)
      const cached = await cacheStore.get<PostOntology>(keys.postOntology(candidate.id, cLastEdited))
      if (cached) summaries.set(candidate.id, cached.summary)
    }

    // post → candidates 방향
    try {
      const fwdEdges = await extractRelations(post, candidates, summaries, opts)
      for (const edge of fwdEdges) {
        if (!state.edges.some((e) => e.source === edge.source && e.target === edge.target && e.kind === edge.kind)) {
          state.edges.push(edge)
        }
      }
    } catch (err) {
      warnLog(`[addPostToState] extractRelations fwd failed for "${post.slug}":`, err)
      throw err
    }

    // candidates → post 방향 (역방향 관계 포착)
    for (const candidate of candidates) {
      const revEdges = await extractRelations(candidate, [post], summaries, opts)
      for (const edge of revEdges) {
        if (!state.edges.some((e) => e.source === edge.source && e.target === edge.target && e.kind === edge.kind)) {
          state.edges.push(edge)
        }
      }
    }
  }

  for (const raw of ont.entities) {
    mergeEntityIntoState(state, post.id, raw)
  }

  state.index[post.id] = lastEdited
}

export async function getOntology(_opts?: { bypassCache?: boolean }): Promise<Ontology | null> {
  const cached = await cacheStore.getShared<OntologyState>(keys.ontologyState)
  if (!cached) return null
  const state = structuredClone(cached)
  const ids = new Set(eligibleGraphPosts(await getPosts()).map((post) => post.id))
  for (const id of Object.keys(state.index)) if (!ids.has(id)) removePostFromState(state, id)
  return toOntology(state)
}

export type OntologyRefreshOptions = {
  bypassCache?: boolean
  posts?: TPost[]
  removedIds?: string[]
  changedIds?: string[]
}
type OntologyBuildResult = { ontology: Ontology; stats: BuildStats }
let ontologyQueue: Promise<void> = Promise.resolve()

export function getOrBuildOntology(opts: OntologyRefreshOptions = {}): Promise<OntologyBuildResult> {
  const work = ontologyQueue.then(() => refreshOntology(opts))
  ontologyQueue = work.then(() => undefined, () => undefined)
  return work
}

async function refreshOntology(opts: OntologyRefreshOptions): Promise<OntologyBuildResult> {
  const posts = eligibleGraphPosts(opts.posts ?? await getPosts())
  const postMap = new Map(posts.map((post) => [post.id, post]))
  let state = structuredClone(await cacheStore.getShared<OntologyState>(keys.ontologyState) ?? emptyState())
  const diff = computeDiff(state.index, posts)
  // Explicit bypass is the manual rebuild command only. Ordinary maintenance never resets this index.
  if (opts.bypassCache) diff.modified = posts.filter((post) => post.id in state.index)
  const removals = [...new Set([...diff.removed, ...(opts.removedIds ?? []).filter((id) => !postMap.has(id))])]
  const semanticIds = new Set([...diff.added, ...diff.modified].map((post) => post.id))
  // Bind an existing timestamp checkpoint to the first body hash without
  // rebuilding its entities or embeddings. Different timestamps still update.
  const checkpointIds = posts.filter(post => post.contentHash && state.index[post.id] === post.lastEditedTime).map(post => post.id)
  const metadataPosts = [...new Set([...(opts.changedIds ?? []), ...checkpointIds])].flatMap((id) => {
    const post = postMap.get(id)
    return post && !semanticIds.has(id) && id in state.index ? [post] : []
  })
  const stats: BuildStats = {
    added: diff.added.length, modified: diff.modified.length, removed: removals.length,
    stateSizeBytes: Buffer.byteLength(JSON.stringify(state), "utf8"),
  }
  if (!semanticIds.size && !removals.length && !metadataPosts.length) return { ontology: toOntology(state), stats }

  // One failing item must not block the rest; failures are aggregated so the run still retries.
  const failures: unknown[] = []
  // Delete vectors before pruning the index: an id whose delete failed stays indexed, so the next
  // diff retries it. Reads already hide it through the eligibility filter.
  const deletedIds = new Set<string>()
  for (const id of removals) {
    try {
      await deletePoint(id)
      deletedIds.add(id)
    } catch (err) {
      failures.push(err)
    }
  }
  const pruned = [...diff.removed.filter((id) => deletedIds.has(id)), ...diff.modified.map((post) => post.id)]
  for (const id of pruned) removePostFromState(state, id)
  // Persist metadata-safe pruning before any expensive extraction.
  if (pruned.length) await cacheStore.setShared(keys.ontologyState, state, ONTOLOGY_STATE_TTL_MS)
  for (const post of metadataPosts) {
    try {
      await updatePostPayload(post)
      state.index[post.id] = postContentVersion(post)
      await cacheStore.setShared(keys.ontologyState, state, ONTOLOGY_STATE_TTL_MS)
    } catch (error) { failures.push(error) }
  }
  for (const post of [...diff.added, ...diff.modified]) {
    const next = structuredClone(state)
    try {
      await addPostToState(next, post, postMap, opts)
    } catch (err) {
      warnLog(`[getOrBuildOntology] extraction failed for "${post.slug}":`, err)
      failures.push(err)
      continue
    }
    state = next
    state.generatedAt = new Date().toISOString()
    // Each committed post survives a later upstream failure and will not be reprocessed on retry.
    await cacheStore.setShared(keys.ontologyState, state, ONTOLOGY_STATE_TTL_MS)
  }
  if (failures.length) throw new AggregateError(failures, `Ontology maintenance failed for ${failures.length} item(s)`)
  stats.stateSizeBytes = Buffer.byteLength(JSON.stringify(state), "utf8")
  debugLog(`[getOrBuildOntology] diff: +${stats.added} ~${stats.modified} -${stats.removed}`)
  return { ontology: toOntology(state), stats }
}
