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
// Client refresh keeps unchanged ISR articles' sidebars current without rebuilding their bodies.
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

