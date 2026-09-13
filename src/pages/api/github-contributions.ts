import type { NextApiRequest, NextApiResponse } from "next"
import { CONFIG } from "site.config"
import { parseGitHubContributionsHtml } from "src/libs/github/contributions"
import type { GitHubContributionData } from "src/libs/github/contributions"

const FETCH_TIMEOUT_MS = 8_000
const CACHE_TTL_MS = 60 * 60 * 1000
const USERNAME_PATTERN = /^[a-z\d](?:[a-z\d-]{0,37}[a-z\d])?$/i

let cache:
  | { username: string; data: GitHubContributionData; expiresAt: number }
  | undefined

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<GitHubContributionData | { error: string }>
) {
  res.setHeader("Cache-Control", "no-store")
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET")
    return res.status(405).json({ error: "Method not allowed" })
  }

  const username = CONFIG.profile.github?.trim()
  if (!username || !USERNAME_PATTERN.test(username)) {
    return res.status(503).json({ error: "GitHub profile is not configured" })
  }

  if (cache?.username === username && cache.expiresAt > Date.now()) {
    res.setHeader(
      "Cache-Control",
      "public, max-age=300, s-maxage=3600, stale-while-revalidate=86400"
    )
    return res.status(200).json(cache.data)
  }

  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS)

  try {
    const response = await fetch(
      `https://github.com/users/${encodeURIComponent(username)}/contributions`,
      {
        headers: {
          Accept: "text/html",
          "User-Agent": "monolog-github-contributions",
          "Accept-Language": "en-US,en;q=0.9",
        },
        signal: controller.signal,
      }
    )
    if (!response.ok) {
      throw new Error(`GitHub returned HTTP ${response.status}`)
    }

    const data = parseGitHubContributionsHtml(await response.text(), username)
    cache = { username, data, expiresAt: Date.now() + CACHE_TTL_MS }
    res.setHeader(
      "Cache-Control",
      "public, max-age=300, s-maxage=3600, stale-while-revalidate=86400"
    )
    return res.status(200).json(data)
  } catch (error) {
    console.error("[github-contributions] fetch failed", error)
    return res.status(502).json({ error: "GitHub contributions unavailable" })
  } finally {
    clearTimeout(timeout)
  }
}
