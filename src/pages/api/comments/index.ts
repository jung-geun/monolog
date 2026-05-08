import { NextApiRequest, NextApiResponse } from "next"
import { cacheStore } from "src/libs/cache"
import { listComments, createComment } from "src/apis/notion-client/comments"
import { commentPostSchema, sanitizeBody, checkSpam } from "src/libs/utils/comments/sanitize"
import { checkRateLimit, checkGetRateLimit } from "src/libs/utils/comments/rateLimit"
import { nicknameSuffix } from "src/libs/utils/comments/hash"
import { getIpHash } from "src/libs/utils/security"
import { getPosts } from "src/apis/notion-client/getPosts"
import type { TPost } from "src/types"
import { CONFIG } from "site.config"

const CACHE_TTL_MS = ((CONFIG as any).notionComments?.cacheTtlSec ?? 45) * 1000

function isAllowedOrigin(req: NextApiRequest): boolean {
  if (process.env.NODE_ENV !== "production") return true
  const origin = req.headers["origin"] as string | undefined
  const referer = req.headers["referer"] as string | undefined
  const source = origin ?? referer
  if (!source) return false
  const allowed = [CONFIG.link, process.env.NEXT_PUBLIC_SITE_URL].filter(Boolean) as string[]
  return allowed.some((base) => source.startsWith(base))
}

async function getSlugMap(): Promise<Map<string, TPost>> {
  const posts = await getPosts()
  const map = new Map<string, TPost>()
  for (const p of posts) {
    if (p.slug) map.set(p.slug, p)
  }
  return map
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method === "GET") {
    const { slug } = req.query
    if (!slug || typeof slug !== "string") {
      return res.status(400).json({ error: "slug required" })
    }

    const ipH = getIpHash(req)
    if (!checkGetRateLimit(ipH).ok) {
      return res.status(429).json({ error: "too many requests" })
    }

    const slugMap = await getSlugMap()
    if (!slugMap.has(slug)) {
      return res.status(200).json({ items: [] })
    }

    try {
      const items = await cacheStore.getOrSet(
        `comments:${slug}`,
        CACHE_TTL_MS,
        () => listComments(slug)
      )
      return res.status(200).json({ items })
    } catch {
      return res.status(500).json({ error: "failed to fetch comments" })
    }
  }

  if (req.method === "POST") {
    if (!isAllowedOrigin(req)) {
      return res.status(403).json({ error: "forbidden" })
    }

    const parsed = commentPostSchema.safeParse(req.body)
    if (!parsed.success) {
      return res.status(400).json({ error: parsed.error.issues[0].message })
    }

    const input = parsed.data
    const spamReason = checkSpam(input)
    if (spamReason) {
      return res.status(400).json({ error: "invalid request" })
    }

    const slugMap = await getSlugMap()
    const post = slugMap.get(input.slug)
    if (!post) {
      return res.status(400).json({ error: "invalid request" })
    }

    const cleanBody = sanitizeBody(input.body)
    if (cleanBody.length < 2) {
      return res.status(400).json({ error: "2자 이상 입력해주세요" })
    }

    const ipH = getIpHash(req)
    const { ok } = checkRateLimit(ipH)
    if (!ok) {
      return res.status(429).json({ error: "too many requests" })
    }

    const suffix = nicknameSuffix(input.slug, ipH)
    const nickname = `익명#${suffix}`

    try {
      const comment = await createComment({
        slug: input.slug,
        postId: post.id,
        body: cleanBody,
        ipHash: ipH,
        nickname,
      })
      await cacheStore.invalidate(`comments:${input.slug}`)
      return res.status(201).json({ comment })
    } catch {
      return res.status(500).json({ error: "failed to create comment" })
    }
  }

  return res.status(405).json({ error: "method not allowed" })
}

export const config = { api: { bodyParser: { sizeLimit: "8kb" } } }
