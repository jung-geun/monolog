import type { NextApiRequest, NextApiResponse } from "next"
import { isIP } from "net"
import { getIp } from "src/libs/utils/security"

export default function handler(
  req: NextApiRequest,
  res: NextApiResponse<{ ip: string } | { error: string }>
) {
  res.setHeader("Cache-Control", "private, no-store, max-age=0")
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET")
    return res.status(405).json({ error: "Method not allowed" })
  }

  const address = getIp(req)
  const mappedAddress = address.startsWith("::ffff:") ? address.slice(7) : ""
  const ip = isIP(mappedAddress) === 4 ? mappedAddress : address
  if (!isIP(ip)) return res.status(503).json({ error: "Client address unavailable" })
  return res.status(200).json({ ip })
}
