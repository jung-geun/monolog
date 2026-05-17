import crypto from "crypto"
import type { NextApiRequest } from "next"

const extractBearerToken = (req: NextApiRequest): string | undefined => {
  const h = req.headers.authorization
  if (typeof h !== "string") return undefined
  const m = h.trim().match(/^Bearer\s+(.+)$/i)
  return m?.[1]
}

let _deprecationWarned = false

export const verifyRevalidateToken = (req: NextApiRequest): boolean => {
  let expected = process.env.REVALIDATE_SECRET
  if (!expected) {
    const legacy = process.env.TOKEN_FOR_REVALIDATE
    if (legacy) {
      if (!_deprecationWarned) {
        _deprecationWarned = true
        console.warn('[revalidate] TOKEN_FOR_REVALIDATE is deprecated — rename env var to REVALIDATE_SECRET')
      }
      expected = legacy
    }
  }

  if (!expected) {
    console.error('[revalidate] neither REVALIDATE_SECRET nor TOKEN_FOR_REVALIDATE is configured — all revalidate requests will be rejected')
    return false
  }

  const provided =
    extractBearerToken(req) ??
    (typeof req.query.secret === "string" ? req.query.secret : undefined)

  if (!provided) return false

  const a = Buffer.from(provided)
  const b = Buffer.from(expected)
  if (a.length !== b.length) return false
  return crypto.timingSafeEqual(a, b)
}
