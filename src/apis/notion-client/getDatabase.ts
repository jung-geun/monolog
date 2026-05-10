import {
  TDbGroupOption,
  TDbIcon,
  TDbPropertySchema,
  TDbPropertyType,
  TDbRow,
  TDbView,
  TNotionDatabase,
} from "src/types"
import { getOfficialNotionClient } from "./notionClient"
import { cacheStore, keys } from "src/libs/cache"
import { debugLog } from "src/libs/utils/logger"

const DATABASE_TTL_MS = 30 * 60 * 1000 // 30 minutes

function normalizeValue(prop: any): unknown {
  if (!prop) return null
  switch (prop.type) {
    case "title":
      return prop.title?.map((t: any) => t.plain_text).join("") ?? ""
    case "rich_text":
      return prop.rich_text?.map((t: any) => t.plain_text).join("") ?? ""
    case "select":
      return prop.select?.name ?? null
    case "status":
      return prop.status?.name ?? null
    case "multi_select":
      return prop.multi_select?.map((s: any) => s.name) ?? []
    case "date":
      return prop.date?.start ?? null
    case "url":
      return prop.url ?? null
    case "checkbox":
      return prop.checkbox ?? false
    case "number":
      return prop.number ?? null
    case "files":
      return prop.files?.[0]?.file?.url ?? prop.files?.[0]?.external?.url ?? null
    case "people":
      return prop.people?.map((p: any) => p.name ?? p.id) ?? []
    default:
      return null
  }
}

function normalizeIcon(icon: any): TDbIcon | null {
  if (!icon) return null
  if (icon.type === "emoji" && typeof icon.emoji === "string") {
    return { type: "emoji", emoji: icon.emoji }
  }
  if (icon.type === "external" && icon.external?.url) {
    return { type: "external", url: icon.external.url }
  }
  if (icon.type === "file" && icon.file?.url) {
    return { type: "file", url: icon.file.url }
  }
  return null
}

function pickGroupBy(properties: TDbPropertySchema[]): string | null {
  // Prefer status > select > multi_select; skip title/rich_text
  const status = properties.find((p) => p.type === "status")
  if (status) return status.name
  const select = properties.find((p) => p.type === "select")
  if (select) return select.name
  const multi = properties.find((p) => p.type === "multi_select")
  if (multi) return multi.name
  return null
}

function extractGroupOptions(
  schema: Record<string, any> | undefined,
  groupBy: string | null
): TDbGroupOption[] | null {
  if (!groupBy || !schema) return null
  const config = schema[groupBy]
  if (!config) return null
  // status: prefer ordered groups (To-do / In progress / Done)
  if (config.type === "status") {
    const groups = config.status?.groups as Array<{ name: string; color: string }> | undefined
    if (groups && groups.length > 0) {
      return groups.map((g) => ({ name: g.name, color: g.color ?? "default" }))
    }
    const options = config.status?.options as Array<{ name: string; color: string }> | undefined
    return options?.map((o) => ({ name: o.name, color: o.color ?? "default" })) ?? null
  }
  if (config.type === "select" || config.type === "multi_select") {
    const options = config[config.type]?.options as
      | Array<{ name: string; color: string }>
      | undefined
    return options?.map((o) => ({ name: o.name, color: o.color ?? "default" })) ?? null
  }
  return null
}

function detectView(blockFormat: any, groupBy: string | null): TDbView | null {
  const viewType = blockFormat?.view_type ?? ""
  if (viewType === "board") return "board"
  if (viewType === "gallery") return "gallery"
  if (viewType === "list") return "list"
  if (viewType === "table") return "table"
  void groupBy
  // No explicit view_type — caller will fall back to fetchActiveViewType
  // (Views API) and finally to 'table'.
  return null
}

/**
 * SDK 5.14+ Views API: fetch the first view's type as the database's active
 * view (Notion treats the first listed view as the default). Replaces the
 * v1.9.2 hard-coded 'table' fallback when blockFormat omits view_type
 * (Notion's child_database block doesn't carry it).
 *
 * Cost: 2 extra API calls (views.list + views.retrieve) on cache miss.
 * On cache hit (database body) this is not invoked because it's wrapped
 * inside cacheStore.getOrSet.
 */
async function fetchActiveViewType(
  databaseId: string,
  notion: any
): Promise<TDbView | null> {
  try {
    const viewsResp: any = await notion.views.list({
      database_id: databaseId,
      page_size: 1,
    })
    const firstId: string | undefined = viewsResp?.results?.[0]?.id
    if (!firstId) return null
    const view: any = await notion.views.retrieve({ view_id: firstId })
    const t = view?.type as string | undefined
    if (t === "table" || t === "board" || t === "gallery" || t === "list") {
      debugLog(`[views] active view type "${t}" for ${databaseId}`)
      return t
    }
    // calendar / timeline / form / chart / map / dashboard fall back to
    // 'table' because our NotionDatabase component only renders the four
    // basic view types. Tracked as a Phase 4 limit.
    debugLog(`[views] unsupported view type "${t}" for ${databaseId}; falling back to table`)
    return "table"
  } catch (e: any) {
    debugLog(`[views] views.list/retrieve failed for ${databaseId}: ${e?.message ?? e}`)
    return null
  }
}

export async function getDatabase(
  databaseId: string,
  blockFormat?: any
): Promise<TNotionDatabase | null> {
  const notion = getOfficialNotionClient()

  // Step 1: databases.retrieve to get last_edited_time, title, and data_sources
  // In Notion v5, database_id ≠ data_source_id — we need to resolve the data source.
  let dbMeta: any
  try {
    dbMeta = await notion.databases.retrieve({ database_id: databaseId })
  } catch (error: any) {
    console.error(`❌ Cannot retrieve database ${databaseId}:`, error.message)
    return null
  }

  const lastEdited: string = dbMeta.last_edited_time ?? "unknown"
  const title: string = dbMeta.title?.[0]?.plain_text ?? "Database"
  const dataSourceId: string | undefined = dbMeta.data_sources?.[0]?.id

  if (!dataSourceId) {
    console.warn(`⚠️ No data source found for database ${databaseId}`)
    return null
  }

  try {
    return await cacheStore.getOrSet(
      keys.database(databaseId, lastEdited),
      DATABASE_TTL_MS,
      async () => {
        debugLog(`📡 Fetching database: ${databaseId} (data_source: ${dataSourceId})`)

        // Step 2: query rows + retrieve full schema (for select/status option order)
        const [queryResp, dsMeta] = await Promise.all([
          notion.dataSources.query({
            data_source_id: dataSourceId,
            page_size: 100,
          }),
          notion.dataSources
            .retrieve({ data_source_id: dataSourceId })
            .catch(() => null as any),
        ])

        const dsProperties: Record<string, any> | undefined = (dsMeta as any)?.properties
        const firstPage = queryResp.results[0] as any
        // Prefer schema from data source retrieve (covers all properties + types);
        // fall back to first row properties if retrieve failed.
        const propertySchemas: TDbPropertySchema[] = dsProperties
          ? Object.entries(dsProperties).map(([name, val]: [string, any]) => ({
              id: val.id ?? name,
              name,
              type: (val.type ?? "rich_text") as TDbPropertyType,
            }))
          : firstPage
          ? Object.entries(firstPage.properties ?? {}).map(([name, val]: [string, any]) => ({
              id: name,
              name,
              type: (val.type ?? "rich_text") as TDbPropertyType,
            }))
          : []

        const rows: TDbRow[] = queryResp.results.map((page: any) => {
          const values: Record<string, unknown> = {}
          for (const [name, prop] of Object.entries(page.properties ?? {})) {
            values[name] = normalizeValue(prop)
          }
          return {
            id: page.id,
            url: `https://www.notion.so/${page.id.replace(/-/g, "")}`,
            lastEdited: page.last_edited_time ?? "",
            icon: normalizeIcon(page.icon),
            values,
          }
        })

        const groupBy = pickGroupBy(propertySchemas)
        const groupOptions = extractGroupOptions(dsProperties, groupBy)

        // View resolution: explicit view_type from block format wins; else
        // ask the Views API for the database's first view; final fallback
        // is 'table'. The Views API call lives inside this getOrSet body
        // so it's cached together with the database content.
        const explicitView = detectView(blockFormat, groupBy)
        const view: TDbView =
          explicitView ?? (await fetchActiveViewType(databaseId, notion)) ?? "table"

        const database: TNotionDatabase = {
          id: databaseId,
          title,
          properties: propertySchemas,
          rows,
          view,
          groupBy,
          groupOptions: groupOptions ?? undefined,
        }

        debugLog(
          `✅ Fetched database "${title}" with ${rows.length} rows (view: ${database.view}${
            groupBy ? `, groupBy: ${groupBy}, ${groupOptions?.length ?? 0} options` : ""
          })`
        )
        return database
      }
    )
  } catch (error: any) {
    console.error(`❌ Failed to fetch database ${databaseId}:`, error.message)
    return null
  }
}
