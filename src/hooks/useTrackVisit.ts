import { useEffect } from "react"
import type { TPost } from "src/types"

const sent = new Set<string>()

export default function useTrackVisit(post?: Pick<TPost, "slug" | "id">): void {
  useEffect(() => {
    if (!post?.slug || !post.id) return

    const key = `${post.id}:${post.slug}`
    if (sent.has(key)) return
    sent.add(key)

    void fetch("/api/visits", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ slug: post.slug, postId: post.id }),
      keepalive: true,
    }).catch(() => undefined)
  }, [post?.slug, post?.id])
}
