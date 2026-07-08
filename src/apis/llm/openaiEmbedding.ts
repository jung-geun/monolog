import OpenAI from "openai"

let _client: OpenAI | null = null

const MODEL = "text-embedding-3-small"
export const EMBEDDING_DIMS = 1536

function getClient(): OpenAI {
  if (!_client) {
    const apiKey = process.env.OPENAI_API_KEY
    if (!apiKey) throw new Error("OPENAI_API_KEY is not set")
    _client = new OpenAI({ apiKey })
  }
  return _client
}

export async function embedText(text: string): Promise<number[]> {
  const client = getClient()
  const res = await client.embeddings.create({ model: MODEL, input: text })
  return res.data[0].embedding
}

export async function embedBatch(texts: string[]): Promise<number[][]> {
  if (texts.length === 0) return []
  const client = getClient()
  const res = await client.embeddings.create({ model: MODEL, input: texts })
  return res.data.map((d) => d.embedding)
}
