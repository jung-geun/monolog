import { useQuery } from "@tanstack/react-query"
import { z } from "zod"
import { queryKey } from "src/constants/queryKey"
import type { TPost } from "src/types"

const postListSchema: z.ZodType<TPost[]> = z.array(z.object({
  id: z.string(),
  title: z.string(),
  slug: z.string(),
  status: z.tuple([z.literal("Public")]),
  type: z.tuple([z.enum(["Post", "Paper"])]),
  date: z.object({ start_date: z.string() }),
  createdTime: z.string(),
  lastEditedTime: z.string().optional(),
  contentHash: z.string().optional(),
  contentModifiedTime: z.string().optional(),
  fullWidth: z.boolean(),
  tags: z.array(z.string()).optional(),
  category: z.array(z.string()).optional(),
  series: z.array(z.string()).optional(),
  summary: z.string().optional(),
  thumbnail: z.string().optional(),
  author: z.array(z.object({ id: z.string(), name: z.string(), profile_photo: z.string().optional() })).optional(),
}))

const usePostsQuery = () => {
  const { data } = useQuery<TPost[]>({
    queryKey: queryKey.posts(),
    queryFn: async () => {
      const response = await fetch("/api/posts")
      if (!response.ok) throw new Error("Publication metadata temporarily unavailable")
      const posts: unknown = await response.json()
      return postListSchema.parse(posts)
    },
    staleTime: 60 * 1000,
    gcTime: 60 * 60 * 1000,
    refetchOnWindowFocus: true,
    refetchInterval: 60 * 1000,
    retry: false,
    enabled: typeof window !== "undefined",
  })

  return data ?? []
}

export default usePostsQuery
