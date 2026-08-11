import { ExtendedRecordMap } from "notion-types"
import { TNotionDatabase } from "src/types"
import { unwrapBlock } from "src/libs/utils/notion"
import { getOfficialNotionClient } from "./notionClient"
import { getDatabase } from "./getDatabase"
import { debugLog } from "src/libs/utils/logger"

/**
 * Extracts and resolves all collection_view_page embedded databases in an ExtendedRecordMap.
 * Performs metadata retrieval, title matching, data-source fallback, and database prefetching.
 */
export async function getRecordMapDatabases(
  recordMap: ExtendedRecordMap
): Promise<Map<string, TNotionDatabase>> {
  const resultMap = new Map<string, TNotionDatabase>()
  if (!recordMap?.block) {
    return resultMap
  }

  const dbBlocks = Object.entries(recordMap.block)
    .filter(([, b]) => unwrapBlock(b)?.type === "collection_view_page")
    .map(([id, b]) => ({ id, format: (unwrapBlock(b) as { format?: Record<string, unknown> } | undefined)?.format }))

  if (dbBlocks.length === 0) {
    return resultMap
  }

  const notion = getOfficialNotionClient()

  type DbMeta = Record<string, unknown> & {
    data_sources?: Array<{ id?: string }>
    title?: Array<{ plain_text?: string }>
  }

  // Pass 1: retrieve metadata for every DB block in parallel.
  const metaResults = await Promise.all(
    dbBlocks.map(({ id }) =>
      notion.databases
        .retrieve({ database_id: id })
        .then((m) => ({ id, meta: m as DbMeta }))
        .catch((e: { code?: string; status?: string; message?: string }) => {
          const code = e?.code ?? e?.status ?? ""
          debugLog(`[prefetch] retrieve failed for ${id} [${code}]: ${e?.message ?? e}`)
          return { id, meta: null }
        })
    )
  )

  // Title normalize — NFC + trim. Invisible/zero-width chars or different
  // unicode forms (e.g. Korean NFD vs NFC) would otherwise cause cache
  // misses across a linked view and its source.
  const normTitle = (s: unknown): string =>
    typeof s === "string" ? s.normalize("NFC").trim() : ""

  // Pass 2a: title → dataSourceId index from source DBs.
  const titleToDsId = new Map<string, string>()
  for (const { meta } of metaResults) {
    const dsId: string | undefined = meta?.data_sources?.[0]?.id
    const title = normTitle(meta?.title?.[0]?.plain_text)
    if (dsId && title) {
      if (titleToDsId.has(title) && titleToDsId.get(title) !== dsId) {
        debugLog(`[prefetch] ambiguous linked-DB title "${title}" — multiple sources; last one wins`)
      }
      titleToDsId.set(title, dsId)
    }
  }

  // Pass 2b: if the page contains exactly one distinct source data_source,
  // use it as a last-resort fallback for any linked block whose title
  // match failed (e.g. retrieve failed, title was renamed). This matches
  // the most common "1 source + N linked views on the same page" pattern.
  const distinctSourceDsIds = Array.from(
    new Set(
      metaResults
        .map(({ meta }) => meta?.data_sources?.[0]?.id as string | undefined)
        .filter((v): v is string => Boolean(v))
    )
  )
  const singleSourceFallback =
    distinctSourceDsIds.length === 1 ? distinctSourceDsIds[0] : undefined

  // Pass 3: prefetch each DB, resolving linked views via cascading fallback:
  //   own data_source → title match → single-source fallback → empty shell
  await Promise.all(
    dbBlocks.map(async ({ id, format }) => {
      const m = metaResults.find((x) => x.id === id)?.meta
      const ownDsId: string | undefined = m?.data_sources?.[0]?.id
      const title = normTitle(m?.title?.[0]?.plain_text)
      const byTitle = !ownDsId ? titleToDsId.get(title) : undefined
      const fallbackDataSourceId: string | undefined =
        ownDsId ? undefined : byTitle ?? singleSourceFallback

      if (ownDsId) {
        debugLog(`[prefetch] ${id} source self ds=${ownDsId} title="${title}"`)
      } else if (byTitle) {
        debugLog(`[prefetch] ${id} linked → title-match ds=${byTitle} title="${title}"`)
      } else if (singleSourceFallback) {
        debugLog(
          `[prefetch] ${id} linked → single-source fallback ds=${singleSourceFallback} title="${title}"`
        )
      } else {
        debugLog(`[prefetch] ${id} linked — no resolution (empty shell) title="${title}"`)
      }

      const db = await getDatabase(id, format, {
        dbMeta: m,
        fallbackDataSourceId,
      }).catch(() => null)

      if (db) {
        resultMap.set(id, db)
      }
    })
  )

  return resultMap
}
