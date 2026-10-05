import type { NextApiRequest, NextApiResponse } from "next"
import { ImageResponse } from "next/og"
import { CONFIG } from "site.config"

// A site-level fallback needs no remote images or request-dependent fonts.
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  res.setHeader("Cache-Control", "no-store")
  if (req.method !== "GET" && req.method !== "HEAD") {
    res.setHeader("Allow", "GET, HEAD")
    res.status(405).end()
    return
  }
  const image = new ImageResponse(
    <div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", justifyContent: "space-between", padding: "72px", background: "#0e0f13", color: "#fbfaf6" }}>
      <div style={{ display: "flex", fontSize: 32, color: "#aaa" }}>{new URL(CONFIG.link).hostname}</div>
      <div style={{ display: "flex", fontSize: 96, fontWeight: 600 }}>{CONFIG.blog.title}</div>
      <div style={{ display: "flex", fontSize: 32 }}>{CONFIG.profile.name} / {CONFIG.profile.role}</div>
    </div>,
    { width: 1200, height: 630 }
  )
  const png = Buffer.from(await image.arrayBuffer())
  res.setHeader("Content-Type", "image/png")
  res.setHeader("Content-Length", png.byteLength)
  res.status(200).end(req.method === "HEAD" ? undefined : png)
}
