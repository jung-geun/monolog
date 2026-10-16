export const queryKey = {
  posts: () => ["posts"],
  tags: () => ["tags"],
  categories: () => ["categories"],
  post: (slug: string) => ["post", slug],
  publicPageLinks: () => ["publicPageLinks"],
  database: (id: string) => ["database", id],
  databases: () => ["databases"],
  notionGraph: () => ["notionGraph"],
}
