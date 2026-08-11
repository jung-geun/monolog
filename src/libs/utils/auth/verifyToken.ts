import crypto from "crypto"
import type { NextApiRequest } from "next"

const extractBearerToken = (req: NextApiRequest): string | undefined => {
  const h = req.headers.authorization
  if (typeof h !== "string") return undefined
  const m = h.trim().match(/^Bearer\s+(.+)$/i)
  return m?.[1]
}

export const verifyRevalidateToken = (req: NextApiRequest): boolean => {
  const expected = process.env.REVALIDATE_SECRET
  if (!expected) {
    console.error("[revalidate] REVALIDATE_SECRET is not configured — all revalidate requests will be rejected")
    return false
  }

  const provided = extractBearerToken(req)
  if (!provided) return false

  const a = Buffer.from(provided)
  const b = Buffer.from(expected)
  if (a.length !== b.length) return false
  return crypto.timingSafeEqual(a, b)
}
