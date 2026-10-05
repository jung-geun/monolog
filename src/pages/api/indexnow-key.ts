import type { NextApiRequest, NextApiResponse } from "next"

export default function handler(req: NextApiRequest, res: NextApiResponse<string>) {
  res.setHeader("Cache-Control", "no-store")

  if (req.method !== "GET" && req.method !== "HEAD") {
    res.setHeader("Allow", "GET, HEAD")
    return res.status(405).end()
  }

  const key = req.query.key
  const configuredKey = process.env["INDEXNOW_KEY"]

  if (
    typeof key !== "string" ||
    key.length < 8 ||
    key.length > 128 ||
    /[^0-9a-f]/i.test(key) ||
    key !== configuredKey
  ) {
    return res.status(404).end()
  }

  res.setHeader("Content-Type", "text/plain; charset=utf-8")
  res.setHeader("Content-Length", key.length)
  return res.status(200).end(req.method === "HEAD" ? undefined : key)
}
