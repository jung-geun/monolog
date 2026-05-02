export const queryKey = {
  scheme: () => ["scheme"],
  posts: () => ["posts"],
  tags: () => ["tags"],
  categories: () => ["categories"],
  post: (slug: string) => ["post", slug],
  database: (id: string) => ["database", id],
  databases: () => ["databases"],
}
