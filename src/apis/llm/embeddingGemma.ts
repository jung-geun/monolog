export const EMBEDDING_MODEL = "google/embeddinggemma-2"
export const EMBEDDING_REVISION = "914f7f89142e33e77833254d9c9b90c3cef7303b"
export const EMBEDDING_DIMS = 768

type EmbeddingTask = "document" | "query"

export function isEmbeddingConfigured(): boolean {
  return Boolean(process.env.EMBEDDING_SERVICE_URL?.trim())
}

async function requestEmbeddings(
  texts: string[],
  task: EmbeddingTask,
  titles?: string[]
): Promise<number[][]> {
  if (titles && titles.length !== texts.length) {
    throw new Error("Embedding titles must have exactly one entry per text")
  }
  if (texts.length === 0) return []
  const serviceUrl = process.env.EMBEDDING_SERVICE_URL?.trim()
  if (!serviceUrl) throw new Error("EMBEDDING_SERVICE_URL is not set")

  const response = await fetch(`${serviceUrl.replace(/\/+$/, "")}/embed`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ model: EMBEDDING_MODEL, revision: EMBEDDING_REVISION, texts, task, ...(titles ? { titles } : {}) }),
    cache: "no-store",
    signal: AbortSignal.timeout(task === "query" ? 30_000 : 10 * 60_000),
  })
  if (!response.ok) {
    // HTTP error JSON is never treated as an embedding payload.
    throw new Error(`Embedding service returned HTTP ${response.status}: ${await response.text()}`)
  }
  const payload: unknown = await response.json()
  if (!payload || typeof payload !== "object") {
    throw new Error("Embedding service returned an invalid response")
  }
  const result = payload as Record<string, unknown>
  if (
    result.model !== EMBEDDING_MODEL ||
    result.dimensions !== EMBEDDING_DIMS ||
    result.revision !== EMBEDDING_REVISION ||
    !Array.isArray(result.embeddings) ||
    result.embeddings.length !== texts.length
  ) {
    throw new Error("Embedding service response does not match the model/dimension/batch contract")
  }
  for (const vector of result.embeddings) {
    if (
      !Array.isArray(vector) ||
      vector.length !== EMBEDDING_DIMS ||
      !vector.every((value: unknown) => typeof value === "number" && Number.isFinite(value))
    ) {
      throw new Error("Embedding service returned an invalid 768d vector")
    }
    const norm = Math.sqrt(vector.reduce((sum: number, value: number) => sum + value * value, 0))
    if (Math.abs(norm - 1) > 1e-4) {
      throw new Error("Embedding service returned a non-normalized vector")
    }
  }
  return result.embeddings as number[][]
}

/** Corpus embedding; the real title is repeated in every service-side token window. */
export async function embedText(text: string, title?: string): Promise<number[]> {
  const vectors = await requestEmbeddings([text], "document", title === undefined ? undefined : [title])
  return vectors[0]
}

/** Corpus embeddings in input order. No title uses the official `title: none` prompt. */
export async function embedBatch(texts: string[], titles?: string[]): Promise<number[][]> {
  return requestEmbeddings(texts, "document", titles)
}

/** Retrieval query embedding using the official SearchQuery task prefix. */
export async function embedQuery(query: string): Promise<number[]> {
  const vectors = await requestEmbeddings([query], "query")
  return vectors[0]
}
