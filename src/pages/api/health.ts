import type { NextApiRequest, NextApiResponse } from "next"

export const config = { api: { bodyParser: false } }

export default function handler(req: NextApiRequest, res: NextApiResponse<string>) {
  res.setHeader("Cache-Control", "no-store")
  res.setHeader("X-Robots-Tag", "noindex")

  if (req.method !== "GET" && req.method !== "HEAD") {
    res.setHeader("Allow", "GET, HEAD")
    return res.status(405).end()
  }

  res.setHeader("Content-Type", "text/plain; charset=utf-8")
  res.setHeader("Content-Length", "3")
  return res.status(200).end(req.method === "HEAD" ? undefined : "ok\n")
}
