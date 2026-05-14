import zlib from "zlib"

// Wrap value so null and "key not found" are distinguishable when stored in Redis
type Envelope<T> = { v: T }

export function encodeEnvelope<T>(value: T): string {
  const json = JSON.stringify({ v: value } as Envelope<T>)
  const compressed = zlib.gzipSync(Buffer.from(json, "utf-8"))
  return compressed.toString("base64")
}

export function decodeEnvelope<T>(raw: string): T | null {
  try {
    const buf = Buffer.from(raw, "base64")
    const decompressed = zlib.gunzipSync(buf)
    const envelope = JSON.parse(decompressed.toString("utf-8")) as Envelope<T>
    return envelope.v
  } catch {
    return null
  }
}
