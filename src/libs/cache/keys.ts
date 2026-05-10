// Bump DB_VERSION when TNotionDatabase schema changes (e.g. new fields like groupBy/icon)
// so previously persisted entries in `.notion-cache/` are treated as misses.
const DB_VERSION = "v3"
// Bump RM_VERSION when convertRichText / processBlock output shape changes
// (e.g. new mention decorations, new format fields) so existing recordMap
// caches are invalidated and re-fetched with the new translator.
const RM_VERSION = "v5"

export const keys = {
  posts: (dataSourceId: string) => `posts:${dataSourceId}`,
  pageIndex: (dataSourceId: string) => `pageIndex:${dataSourceId}`,
  recordMap: (pageId: string, lastEdited: string) =>
    `recordMap:${RM_VERSION}:${pageId}:${lastEdited}`,
  database: (databaseId: string, lastEdited: string) =>
    `database:${DB_VERSION}:${databaseId}:${lastEdited}`,
  user: (userId: string) => `user:${userId}`,
  og: (url: string) => `og:${url}`,
}
