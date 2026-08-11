import type { QueryClient } from "@tanstack/react-query"
import { queryKey } from "src/constants/queryKey"
import { filterPosts } from "src/libs/utils/notion"
import type { FilterPostsOptions } from "src/libs/utils/notion/filterPosts"
import type { TPosts } from "src/types"

// The post list rendered by the editor sidebar (FileTree), the command palette and the feed.
export const FEED_POSTS_FILTER: FilterPostsOptions = {
  acceptStatus: ["Public"],
  acceptType: ["Post", "Paper"],
}

// Seeds queryKey.posts() so the page hydrates the sidebar/palette post list.
// usePostsQuery is `enabled: false`, so any page that skips this renders an empty sidebar.
export const prefetchFeedPosts = async (
  queryClient: QueryClient,
  allPosts: TPosts
): Promise<TPosts> => {
  const posts = filterPosts(allPosts, FEED_POSTS_FILTER)
  await queryClient.prefetchQuery({
    queryKey: queryKey.posts(),
    queryFn: () => posts,
  })
  return posts
}

// ISR guard: when Notion returns nothing during revalidation, throwing makes Next.js
// keep the previously generated static HTML instead of publishing an empty page.
// Skipped during `next build` so a cold build can still succeed.
export const assertFeedNotEmpty = (posts: TPosts): void => {
  if (posts.length === 0 && process.env.NEXT_PHASE !== "phase-production-build") {
    throw new Error("getPosts returned 0 posts — preserving previous static HTML")
  }
}
