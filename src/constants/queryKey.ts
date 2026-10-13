export const queryKey = {
  posts: () => ["posts"],
  tags: () => ["tags"],
  categories: () => ["categories"],
  post: (slug: string) => ["post", slug],
  database: (id: string) => ["database", id],
  databases: () => ["databases"],
  notionGraph: () => ["notionGraph"],
}
