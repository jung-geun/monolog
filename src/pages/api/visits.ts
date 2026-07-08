import { createHash, randomUUID } from "crypto"
import type { NextApiRequest, NextApiResponse } from "next"
import { getCookie, setCookie } from "cookies-next/server"
import { z } from "zod"
import { CONFIG } from "site.config"
import { getPosts } from "src/apis/notion-client/getPosts"
import { trackUniqueVisit } from "src/apis/notion-client/visits"
import { getIp, isRequestOriginAllowed } from "src/libs/utils/security"
import { checkVisitRateLimit } from "src/libs/utils/visits/rateLimit"
import type { TPost, TPosts } from "src/types"

const VISITOR_COOKIE_NAME = "monolog_visitor_id"
const VISITOR_COOKIE_MAX_AGE = 60 * 60 * 24 * 365

const visitPostSchema = z.object({
  slug: z.string().min(1).max(200),
  postId: z.string().min(1).max(100),
})

let memoSlugMap: { source: TPosts; map: Map<string, TPost> } | null = null

async function getSlugMap(): Promise<Map<string, TPost>> {
  const posts = await getPosts()
  if (memoSlugMap && memoSlugMap.source === posts) return memoSlugMap.map

  const map = new Map<string, TPost>()
  for (const post of posts) {
    if (post.slug) map.set(post.slug, post)
  }

  memoSlugMap = { source: posts, map }
  return map
}

async function getVisitorId(req: NextApiRequest, res: NextApiResponse): Promise<string> {
  const stored = await getCookie(VISITOR_COOKIE_NAME, { req, res })
  if (typeof stored === "string" && stored.length > 0) return stored

  const visitorId = randomUUID()
  await setCookie(VISITOR_COOKIE_NAME, visitorId, {
    req,
    res,
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: VISITOR_COOKIE_MAX_AGE,
  })
  return visitorId
}

function visitRateLimitKey(req: NextApiRequest): string {
  const salt = process.env.VISITOR_HASH_SALT
  if (!salt) throw new Error("VISITOR_HASH_SALT is required")
  return createHash("sha256").update(`${getIp(req)}${salt}`).digest("hex").slice(0, 16)
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "method not allowed" })
  }

  if (!isRequestOriginAllowed(req, [CONFIG.link, process.env.NEXT_PUBLIC_SITE_URL, process.env.SITE_URL, process.env.NEXT_PUBLIC_APP_URL, process.env.VERCEL_URL])) {
    return res.status(403).json({ error: "forbidden" })
  }

  const parsed = visitPostSchema.safeParse(req.body)
  if (!parsed.success) {
    return res.status(400).json({ error: "invalid request" })
  }

  const input = parsed.data
  const slugMap = await getSlugMap()
  const post = slugMap.get(input.slug)
  if (!post || post.id !== input.postId) {
    return res.status(400).json({ error: "invalid request" })
  }

  try {
    const ipH = visitRateLimitKey(req)
    if (!checkVisitRateLimit(ipH).ok) {
      return res.status(429).json({ error: "too many requests" })
    }

    const visitorId = await getVisitorId(req, res)
    const result = await trackUniqueVisit({
      slug: input.slug,
      postId: post.id,
      visitorId,
    })

    return res.status(200).json(result)
  } catch (error: unknown) {
    console.error("Failed to track visit:", error)
    return res.status(500).json({ error: "failed to track visit" })
  }
}

export const config = { api: { bodyParser: { sizeLimit: "2kb" } } }
