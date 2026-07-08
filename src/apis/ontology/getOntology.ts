import { createHash } from "crypto"
import { getPosts } from "src/apis/notion-client/getPosts"
import { cacheStore, keys } from "src/libs/cache"
import { buildOntology } from "./buildOntology"
import { extractPostOntology } from "./extractPostOntology"
import { extractRelations } from "./extractRelations"
import { searchSimilar, normalizeUUID, deletePoint } from "src/apis/vector/qdrantClient"
import { Ontology, OntologyState, PostOntology, Entity } from "src/types/ontology"
import { TPost } from "src/types"
import { debugLog, warnLog } from "src/libs/utils/logger"

const ONTOLOGY_STATE_TTL_MS = 30 * 24 * 60 * 60 * 1000
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
    const lastEdited = post.lastEditedTime ?? post.createdTime
    if (!(post.id in index)) added.push(post)
    else if (index[post.id] !== lastEdited) modified.push(post)
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
  opts: { bypassCache?: boolean }
): Promise<void> {
  const lastEdited = post.lastEditedTime ?? post.createdTime

  // entity 추출 + 임베딩 + Qdrant upsert (캐시 히트면 LLM 스킵)
  const ont = await extractPostOntology(post, opts)

  // 벡터 검색으로 기존 그래프 내 후보 추출
  const vector = await cacheStore.get<number[]>(keys.embedding(post.id, lastEdited))
  const candidates: TPost[] = []

  if (vector) {
    let similar: Awaited<ReturnType<typeof searchSimilar>> = []
    try {
      similar = await searchSimilar(vector, TOP_K, normalizeUUID(post.id))
    } catch (err) {
      warnLog(`[addPostToState] Qdrant search failed for "${post.slug}":`, err)
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
      const cLastEdited = candidate.lastEditedTime ?? candidate.createdTime
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
    }

    // candidates → post 방향 (역방향 관계 포착)
    for (const candidate of candidates) {
      try {
        const revEdges = await extractRelations(candidate, [post], summaries, opts)
        for (const edge of revEdges) {
          if (!state.edges.some((e) => e.source === edge.source && e.target === edge.target && e.kind === edge.kind)) {
            state.edges.push(edge)
          }
        }
      } catch (err) {
        warnLog(`[addPostToState] extractRelations rev failed for "${candidate.slug}":`, err)
      }
    }
  }

  for (const raw of ont.entities) {
    mergeEntityIntoState(state, post.id, raw)
  }

  state.index[post.id] = lastEdited
}

export async function getOntology(_opts?: { bypassCache?: boolean }): Promise<Ontology | null> {
  const state = await cacheStore.get<OntologyState>(keys.ontologyState)
  if (!state) return null
  return toOntology(state)
}

export async function getOrBuildOntology(
  opts: { bypassCache?: boolean } = {}
): Promise<{ ontology: Ontology; stats: BuildStats }> {
  const posts = await getPosts()
  const postMap = new Map<string, TPost>(posts.map((p) => [p.id, p]))

  if (opts.bypassCache) {
    const ontology = await buildOntology({ bypassCache: true })
    const newState: OntologyState = {
      ...ontology,
      index: Object.fromEntries(posts.map((p) => [p.id, p.lastEditedTime ?? p.createdTime])),
    }
    await cacheStore.set(keys.ontologyState, newState, ONTOLOGY_STATE_TTL_MS)
    const stateJson = JSON.stringify(newState)
    return {
      ontology,
      stats: {
        added: posts.length,
        modified: 0,
        removed: 0,
        stateSizeBytes: Buffer.byteLength(stateJson, "utf8"),
      },
    }
  }

  const state = (await cacheStore.get<OntologyState>(keys.ontologyState)) ?? emptyState()
  const diff = computeDiff(state.index, posts)

  debugLog(`[getOrBuildOntology] diff: +${diff.added.length} ~${diff.modified.length} -${diff.removed.length}`)

  // 수정/삭제된 페이지를 먼저 그래프에서 제거
  for (const postId of [...diff.removed, ...diff.modified.map((p) => p.id)]) {
    removePostFromState(state, postId)
    try {
      await deletePoint(postId)
    } catch (err) {
      warnLog(`[getOrBuildOntology] deletePoint failed for ${postId}:`, err)
    }
  }

  // 추가/수정된 페이지를 순차 처리 (각 처리 후 state.index 갱신 → 다음 페이지에서 후보로 연결 가능)
  for (const post of [...diff.added, ...diff.modified]) {
    try {
      await addPostToState(state, post, postMap, opts)
    } catch (err) {
      warnLog(`[getOrBuildOntology] addPostToState failed for "${post.slug}":`, err)
    }
  }

  state.generatedAt = new Date().toISOString()
  await cacheStore.set(keys.ontologyState, state, ONTOLOGY_STATE_TTL_MS)

  const stateJson = JSON.stringify(state)
  const stats: BuildStats = {
    added: diff.added.length,
    modified: diff.modified.length,
    removed: diff.removed.length,
    stateSizeBytes: Buffer.byteLength(stateJson, "utf8"),
  }

  debugLog(
    `[getOrBuildOntology] done: ${state.entities.length} entities, ${state.edges.length} edges, ${stats.stateSizeBytes} bytes`
  )

  return { ontology: toOntology(state), stats }
}
