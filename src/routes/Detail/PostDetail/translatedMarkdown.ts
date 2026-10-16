import { CONFIG } from "site.config"
import type { TNotionDatabase, TPost } from "src/types"
import { renderPostMarkdownDocument, type MarkdownDocument } from "src/libs/utils/notion/markdown"
import { getBlockById } from "src/libs/utils/notion/unwrapBlock"
import type { TranslationArticle } from "./articleTranslation"

export interface TranslatedMarkdownInput {
  post: TPost | null | undefined
  article: TranslationArticle
  allPosts: ReadonlyArray<Pick<TPost, "id" | "slug">>
  /** Same prefetched queryKey.database(blockId) values used by Preview, keyed by block ID.
   * Database contents are not translated by TranslationArticle. Never resolve them
   * through src/apis in the browser; absent entries retain the serializer's title fallback.
   */
  databases?: ReadonlyMap<string, TNotionDatabase>
  siteUrl?: string
}

const emptyDatabases: ReadonlyMap<string, TNotionDatabase> = new Map()

/** Display-only projection of the exact Preview snapshot, including partial translations.
 * No translation, fetching, mutation, or Markdown string replacement happens here.
 * Call only while translation is active; pass undefined to MarkdownSource on restore.
 * Null means the article/root is not available yet, not an empty translated document.
 */
export function renderTranslatedMarkdownDocument({
  post, article, allPosts, databases = emptyDatabases, siteUrl = CONFIG.link,
}: TranslatedMarkdownInput): MarkdownDocument | null {
  if (!post || !article.recordMap || !getBlockById(article.recordMap, post.id)) return null
  return renderPostMarkdownDocument(
    { ...post, title: article.title, summary: article.summary },
    article.recordMap,
    databases,
    { siteUrl, allPosts },
  )
}
