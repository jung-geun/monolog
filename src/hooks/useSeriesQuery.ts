import usePostsQuery from "./usePostsQuery"
import { getAllSelectItemsFromPosts } from "src/libs/utils/notion"

export const useSeriesQuery = () => {
  const posts = usePostsQuery()
  return getAllSelectItemsFromPosts("series", posts)
}
