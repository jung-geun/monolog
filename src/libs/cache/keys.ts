// Bump DB_VERSION when TNotionDatabase schema changes (e.g. new fields like groupBy/icon)
// so previously persisted entries in `.notion-cache/` are treated as misses.
const DB_VERSION = "v6"
// Bump RM_VERSION when convertRichText / processBlock output shape changes
// (e.g. new mention decorations, new format fields) so existing recordMap
// caches are invalidated and re-fetched with the new translator.
const RM_VERSION = "v7"
// Bump NG_VERSION when NotionGraph schema changes (e.g. new edge types, node fields)
// so cached graphs are discarded and rebuilt with the new shape.
const NG_VERSION = "v4"
const OG_VERSION = "v2"
// Bump POSTS_VERSION when TPost shape changes (e.g. new fields like lastEditedTime)
// so FS-cached posts without the new field are discarded immediately.
const POSTS_VERSION = "v2"

export const keys = {
  posts: (dataSourceId: string) => `posts:${POSTS_VERSION}:${dataSourceId}`,
  pageIndex: (dataSourceId: string) => `pageIndex:${POSTS_VERSION}:${dataSourceId}`,
  recordMap: (pageId: string, lastEdited: string) =>
    `recordMap:${RM_VERSION}:${pageId}:${lastEdited}`,
  database: (databaseId: string, lastEdited: string) =>
    `database:${DB_VERSION}:${databaseId}:${lastEdited}`,
  user: (userId: string) => `user:${userId}`,
  og: (url: string) => `og:${OG_VERSION}:${url}`,
  notionGraph: (hash: string) => `notionGraph:${NG_VERSION}:${hash}`,
  comments: (slug: string) => `comments:${slug}`,
}
