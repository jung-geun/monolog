import { createHash } from "crypto"

export type GraphHashPost = {
  id: string
  lastEditedTime?: string
  createdTime: string
}

export function computePostsGraphHash(posts: GraphHashPost[]): string {
  const sig = posts
    .map((p) => `${p.id}:${p.lastEditedTime ?? p.createdTime}`)
    .sort()
    .join("|")
  return createHash("sha1").update(sig).digest("hex").slice(0, 16)
}
