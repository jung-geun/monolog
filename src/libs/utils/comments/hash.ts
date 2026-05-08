import { createHash } from "crypto"

const salt = () => {
  const s = process.env.COMMENT_HASH_SALT
  if (!s) throw new Error("COMMENT_HASH_SALT is required but not set")
  return s
}

export function ipHash(ip: string): string {
  return createHash("sha256").update(ip + salt()).digest("hex").slice(0, 16)
}

export function nicknameSuffix(slug: string, ipHashValue: string): string {
  return createHash("sha256")
    .update(slug + ipHashValue + salt())
    .digest("hex")
    .slice(0, 6)
}
