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

  debugLog(`🔍 [filterPosts] Filtering ${posts.length} posts with options:`, {
    acceptStatus,
    acceptType
  })

  const filteredPosts = posts
    // filter data
    .filter((post) => {
      const postDate = new Date(post?.date?.start_date || post.createdTime)
      const isDev = process.env.NODE_ENV === 'development'
      const isValid = !(!post.title || !post.slug || (!isDev && postDate > tomorrow))

      if (!isValid) {
        debugLog(`  ❌ [filterPosts] Rejected (invalid data): slug="${post.slug}", title="${post.title}"`)
      }

      return isValid
    })
    // filter status
    .filter((post) => {
      const postStatus = post.status[0]
      const isDev = process.env.NODE_ENV === 'development'
      const isPrivate = postStatus === 'Private'
      const isAccepted = acceptStatus.includes(postStatus) || (isDev && isPrivate)

      if (!isAccepted) {
        debugLog(`  ❌ [filterPosts] Rejected (status): slug="${post.slug}", status="${postStatus}"`)
      } else if (post.slug === 'about') {
        debugLog(`  ✅ [filterPosts] About page passed status filter: status="${postStatus}"`)
      }

      return isAccepted
    })
    // filter type
    .filter((post) => {
      const postType = post.type[0]
      const isAccepted = acceptType.includes(postType)

      if (!isAccepted) {
        debugLog(`  ❌ [filterPosts] Rejected (type): slug="${post.slug}", type="${postType}"`)
      } else if (post.slug === 'about') {
        debugLog(`  ✅ [filterPosts] About page passed type filter: type="${postType}"`)
      }

      return isAccepted
    })

  debugLog(`🔍 [filterPosts] Result: ${filteredPosts.length} posts after filtering`)

  // Log about page specifically
  const aboutPage = filteredPosts.find(p => p.slug === 'about')
  if (aboutPage) {
    debugLog(`  ✅ About page found in filtered results:`, {
      id: aboutPage.id,
      title: aboutPage.title,
      slug: aboutPage.slug,
      status: aboutPage.status,
      type: aboutPage.type
    })
  } else {
    debugLog(`  ⚠️  About page NOT in filtered results`)
    const aboutInOriginal = posts.find(p => p.slug === 'about')
    if (aboutInOriginal) {
      debugLog(`  ℹ️  But about page exists in original posts:`, {
        id: aboutInOriginal.id,
        title: aboutInOriginal.title,
        slug: aboutInOriginal.slug,
        status: aboutInOriginal.status,
        type: aboutInOriginal.type
      })
    }
  }

  return filteredPosts
}
