import crypto from "crypto"
import type { NextApiRequest } from "next"

const extractBearerToken = (req: NextApiRequest): string | undefined => {
  const h = req.headers.authorization
  if (typeof h !== "string") return undefined
  const m = h.trim().match(/^Bearer\s+(.+)$/i)
  return m?.[1]
}

export const verifyRevalidateToken = (req: NextApiRequest): boolean => {
  const expected = process.env.TOKEN_FOR_REVALIDATE
  if (!expected) return false

  const provided =
    extractBearerToken(req) ??
    (typeof req.query.secret === "string" ? req.query.secret : undefined)

  if (!provided) return false

  const a = Buffer.from(provided)
  const b = Buffer.from(expected)
  if (a.length !== b.length) return false
  return crypto.timingSafeEqual(a, b)
}
