import { createHash } from "crypto"
import type { TPost } from "src/types"
import { isFeedPost, selectPublicPosts } from "src/libs/utils/notion/publication"

export type GraphHashPost = Pick<TPost, "id" | "createdTime" | "lastEditedTime" | "contentHash"> &
  Partial<Pick<TPost, "title" | "slug" | "category" | "tags" | "series" | "type" | "status" | "date">>

export function postContentVersion(post: Pick<TPost, "contentHash" | "lastEditedTime" | "createdTime">): string {
  return post.contentHash || post.lastEditedTime || post.createdTime
}

export function eligibleGraphPosts(posts: TPost[]): TPost[] {
  return selectPublicPosts([...posts]).filter(isFeedPost)
}

export function computePostsGraphHash(posts: GraphHashPost[]): string {
  const sig = posts.map((post) => JSON.stringify([
    post.id, postContentVersion(post), post.createdTime, post.title, post.slug,
    post.category ?? [], post.tags ?? [], post.series ?? [], post.type ?? [],
    post.status ?? [], post.date?.start_date,
  ])).sort().join("|")
  return createHash("sha1").update(sig).digest("hex").slice(0, 16)
}
