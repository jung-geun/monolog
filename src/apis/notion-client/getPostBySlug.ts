import { TPost } from "src/types"
import { getPosts } from "./getPosts"

export const getPostBySlug = async (slug: string): Promise<TPost | null> => {
  const posts = await getPosts()
  return posts.find((post) => post.slug === slug) ?? null
}
