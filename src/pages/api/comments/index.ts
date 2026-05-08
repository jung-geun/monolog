import { NextApiRequest, NextApiResponse } from "next"
import { cacheStore } from "src/libs/cache"
import { listComments, createComment } from "src/apis/notion-client/comments"
import { commentPostSchema, sanitizeBody, checkSpam } from "src/libs/utils/comments/sanitize"
import { checkRateLimit, checkGetRateLimit } from "src/libs/utils/comments/rateLimit"
import { ipHash as hashIp, nicknameSuffix } from "src/libs/utils/comments/hash"
import { getPosts } from "src/apis/notion-client/getPosts"
import { CONFIG } from "site.config"

const CACHE_TTL_MS = ((CONFIG as any).notionComments?.cacheTtlSec ?? 45) * 1000

function getIp(req: NextApiRequest): string {
  const hops = parseInt(process.env.TRUSTED_PROXY_HOPS ?? "0", 10)
  if (hops > 0) {
    const forwarded = req.headers["x-forwarded-for"]
    if (typeof forwarded === "string") {
      const ips = forwarded.split(",").map((s) => s.trim())
      const idx = ips.length - hops
      if (idx >= 0) return ips[idx]
    }
  }
  return req.socket?.remoteAddress ?? "unknown"
}

function isAllowedOrigin(req: NextApiRequest): boolean {
  if (process.env.NODE_ENV !== "production") return true
  const origin = req.headers["origin"] as string | undefined
  const referer = req.headers["referer"] as string | undefined
  const source = origin ?? referer
  if (!source) return false
  const allowed = [CONFIG.link, process.env.NEXT_PUBLIC_SITE_URL].filter(Boolean) as string[]
  return allowed.some((base) => source.startsWith(base))
}

async function getKnownSlugs(): Promise<Set<string>> {
  const posts = await getPosts()
  return new Set(posts.map((p) => p.slug).filter(Boolean) as string[])
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method === "GET") {
    const { slug } = req.query
    if (!slug || typeof slug !== "string") {
      return res.status(400).json({ error: "slug required" })
    }

    const ip = getIp(req)
    const ipH = hashIp(ip)
    if (!checkGetRateLimit(ipH).ok) {
      return res.status(429).json({ error: "too many requests" })
    }

    const knownSlugs = await getKnownSlugs()
    if (!knownSlugs.has(slug)) {
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

    const knownSlugs = await getKnownSlugs()
    if (!knownSlugs.has(input.slug)) {
      return res.status(400).json({ error: "invalid request" })
    }

    const cleanBody = sanitizeBody(input.body)
    if (cleanBody.length < 2) {
      return res.status(400).json({ error: "2자 이상 입력해주세요" })
    }

    const ip = getIp(req)
    const ipH = hashIp(ip)
    const { ok } = checkRateLimit(ipH)
    if (!ok) {
      return res.status(429).json({ error: "too many requests" })
    }

    const suffix = nicknameSuffix(input.slug, ipH)
    const nickname = `익명#${suffix}`

    try {
      const comment = await createComment({
        slug: input.slug,
        postId: input.postId,
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
