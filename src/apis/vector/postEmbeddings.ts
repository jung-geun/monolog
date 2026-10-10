import type { ExtendedRecordMap } from "notion-types"
import type { ContentSnapshot } from "src/libs/content/types"
import { eligibleGraphPosts } from "src/apis/notion-client/graphHash"
import { embedBatch, isEmbeddingConfigured } from "src/apis/llm/embeddingGemma"
import { getBlockById } from "src/libs/utils/notion/unwrapBlock"
import { getNotionRichTextPlainText } from "src/libs/utils/notion/richText"
import { postEmbeddingVersion } from "./postEmbeddingVersion"
import { deleteEmbeddings, embeddingPayload, ensureCollection, normalizeUUID, readPostEmbeddings, updateEmbeddingMetadata, upsertEmbeddings } from "./qdrantClient"

export function articleEmbeddingText(recordMap: ExtendedRecordMap, rootId: string): string {
  const root = getBlockById(recordMap, rootId)
  if (!root) throw new Error("Published article body is unavailable for embedding")
  const visited = new Set<string>([root.id])
  const paragraphs: string[] = []
  const walk = (ids: string[] | undefined) => {
    for (const id of ids ?? []) {
      if (visited.has(id)) continue
      visited.add(id)
      const block = getBlockById(recordMap, id)
      if (!block) continue
      // Child pages/linked collections are separate documents, not this body.
      if (block.type === "page" || block.type === "collection_view" || block.type === "collection_view_page") continue
      for (const value of Object.values(block.properties ?? {})) {
        const text = getNotionRichTextPlainText(value).replace(/[‣⁍]/g, "").trim()
        if (text) paragraphs.push(text)
      }
      if (block.type === "transclusion_reference") {
        const pointer = block.format?.transclusion_reference_pointer.id
        if (pointer) walk([pointer])
      } else walk(block.content)
    }
  }
  walk(root.content)
  return paragraphs.join("\n\n")
}

export type EmbeddingReconcileResult = { updated: number; pending: string[]; failed: string[] }
export async function reconcilePostEmbeddings(snapshot: ContentSnapshot, deadline: number): Promise<EmbeddingReconcileResult> {
  const result: EmbeddingReconcileResult = { updated: 0, pending: [], failed: [] }
  if (!isEmbeddingConfigured()) return result
  const posts = eligibleGraphPosts(snapshot.posts)
  await ensureCollection()
  const existing = await readPostEmbeddings(false)
  const eligible = new Set(posts.map(post => normalizeUUID(post.id)))
  await deleteEmbeddings([...existing.keys()].filter(id => !eligible.has(id)))
  const changed: typeof posts = []
  for (const post of posts) {
    const previous = existing.get(normalizeUUID(post.id))
    if (previous?.payload.documentHash !== postEmbeddingVersion(post)) {
      changed.push(post)
      continue
    }
    try {
      if (JSON.stringify(previous.payload) !== JSON.stringify(embeddingPayload(post))) await updateEmbeddingMetadata(post)
    } catch {
      result.failed.push(post.id)
      result.pending.push(post.id)
    }
  }
  // Bounded batches amortize HTTP/checkpoint costs without loading the corpus
  // into the inference service in one request. Completed batches survive retries.
  for (let offset = 0; offset < changed.length; offset += 8) {
    const batch = changed.slice(offset, offset + 8)
    if (Date.now() >= deadline) {
      result.pending.push(...changed.slice(offset).map(post => post.id))
      break
    }
    try {
      const texts = batch.map(post => {
        const body = snapshot.recordMaps[post.id]
        if (!body) throw new Error("Published article body missing")
        return articleEmbeddingText(body, post.id)
      })
      const vectors = await embedBatch(texts, batch.map(post => post.title))
      // Qdrant's confirmed durable upsert is the checkpoint, not an expiring cache.
      await upsertEmbeddings(batch, vectors)
      result.updated += batch.length
    } catch {
      result.failed.push(...batch.map(post => post.id))
      result.pending.push(...batch.map(post => post.id))
    }
  }
  return result
}
