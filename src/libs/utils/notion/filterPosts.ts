import { debugLog } from "src/libs/utils/logger"
import { TPosts, TPostStatus, TPostType } from "src/types"
import { isSafePostSlug } from "./publication"

export type FilterPostsOptions = {
  acceptStatus?: TPostStatus[]
  acceptType?: TPostType[]
}

const initialOption: FilterPostsOptions = {
  acceptStatus: ["Public"],
  acceptType: ["Post", "Paper"],
}

const parsePostDate = (value: string | undefined): Date | null => {
  if (!value) return null
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? null : date
}

export function filterPosts(
  posts: TPosts,
  options: FilterPostsOptions = initialOption
) {
  const { acceptStatus = ["Public"], acceptType = ["Post", "Paper"] } = options
  const now = new Date()

  debugLog(`🔍 [filterPosts] Filtering ${posts.length} posts`, { acceptStatus, acceptType })

  const filteredPosts = posts
    .filter((post) => {
      if (!post.title?.trim() || !isSafePostSlug(post.slug)) return false

      const postDate =
        parsePostDate(post.date?.start_date) ??
        parsePostDate(post.createdTime)

      if (!postDate) return false

      return postDate <= now
    })
    .filter((post) => {
      const postStatus = post.status?.[0]
      return acceptStatus.includes(postStatus)
    })
    .filter((post) => {
      const postType = post.type?.[0]
      return acceptType.includes(postType)
    })

  debugLog(`🔍 [filterPosts] Result: ${filteredPosts.length} posts`)

  return filteredPosts
}
