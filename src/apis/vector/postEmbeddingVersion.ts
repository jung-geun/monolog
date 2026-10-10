import { createHash } from "crypto"
import type { TPost } from "src/types"
import { postContentVersion } from "src/apis/notion-client/graphHash"
import { EMBEDDING_MODEL, EMBEDDING_REVISION } from "src/apis/llm/embeddingGemma"

// Includes all model input changes; slug, tags, category and edit timestamps do
// not cause inference when the authoritative article body hash is unchanged.
export function postEmbeddingVersion(post: TPost): string {
  return createHash("sha256").update(JSON.stringify([
    EMBEDDING_MODEL, EMBEDDING_REVISION, "article-text-token-chunks-v1",
    post.title, postContentVersion(post),
  ])).digest("hex")
}
