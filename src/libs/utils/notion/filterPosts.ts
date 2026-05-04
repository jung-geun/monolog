import { debugLog } from "src/libs/utils/logger"
import { TPosts, TPostStatus, TPostType } from "src/types"

export type FilterPostsOptions = {
  acceptStatus?: TPostStatus[]
  acceptType?: TPostType[]
}

const initialOption: FilterPostsOptions = {
  acceptStatus: ["Public"],
  acceptType: ["Post", "Paper"],
}
const current = new Date()
const tomorrow = new Date(current)
tomorrow.setDate(tomorrow.getDate() + 1)
tomorrow.setHours(0, 0, 0, 0)

export function filterPosts(
  posts: TPosts,
  options: FilterPostsOptions = initialOption
) {
  const { acceptStatus = ["Public"], acceptType = ["Post", "Paper"] } = options

  debugLog(`🔍 [filterPosts] Filtering ${posts.length} posts`, { acceptStatus, acceptType })

  const filteredPosts = posts
    .filter((post) => {
      const postDate = new Date(post?.date?.start_date || post.createdTime)
      const isDev = process.env.NODE_ENV === 'development'
      return !(!post.title || !post.slug || (!isDev && postDate > tomorrow))
    })
    .filter((post) => {
      const postStatus = post.status[0]
      const isDev = process.env.NODE_ENV === 'development'
      const isPrivate = postStatus === 'Private'
      return acceptStatus.includes(postStatus) || (isDev && isPrivate)
    })
    .filter((post) => {
      const postType = post.type[0]
      return acceptType.includes(postType)
    })

  debugLog(`🔍 [filterPosts] Result: ${filteredPosts.length} posts`)

  return filteredPosts
}
