// Bump DB_VERSION when TNotionDatabase schema changes (e.g. new fields like groupBy/icon)
// so previously persisted entries in `.notion-cache/` are treated as misses.
const DB_VERSION = "v3"

export const keys = {
  posts: (dataSourceId: string) => `posts:${dataSourceId}`,
  recordMap: (pageId: string, lastEdited: string) => `recordMap:${pageId}:${lastEdited}`,
  database: (databaseId: string, lastEdited: string) =>
    `database:${DB_VERSION}:${databaseId}:${lastEdited}`,
}
