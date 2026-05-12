import {
  TDbGroupOption,
  TDbIcon,
  TDbPropertySchema,
  TDbPropertyType,
  TDbRow,
  TDbView,
  TDbViewMeta,
  TDbViewProperty,
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
    case "date": {
      const d = prop.date
      if (!d?.start) return null
      return d.end ? { start: d.start as string, end: d.end as string } : { start: d.start as string }
    }
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
  // No explicit view_type — caller will fall back to fetchViewInfo
  // (Views API) and finally to 'table'.
  return null
}

function parseViewType(t: string | undefined): TDbView | null {
  if (t === "table" || t === "board" || t === "gallery" || t === "list") return t
  if (t) debugLog(`[views] unsupported view type "${t}"; falling back to table`)
  return t ? "table" : null
}

function parseViewProperties(view: any): TDbViewProperty[] | null {
  const props: any[] | undefined = view?.configuration?.properties
  if (!props || props.length === 0) return null
  return props.map((p: any) => ({
    propertyId: p.property_id as string,
    name: (p.property_name as string | undefined) ?? "",
    visible: p.visible !== false,
    width: typeof p.width === "number" ? p.width : null,
  }))
}

/**
 * SDK 5.14+ Views API: fetch the column configuration for the view that
 * matches the block's explicit view type. If `preferredType` is given, finds
 * a view of that type among all the DB's views (e.g. block renders as gallery
 * → use the gallery view's `properties` config, not the first table view's).
 *
 * On cache miss: 1 list call + retrieve calls until match (early exit).
 * Tries database_id first; falls back to data_source_id for linked views.
 */
async function fetchViewInfo(
  databaseId: string,
  notion: any,
  opts?: { fallbackDataSourceId?: string; preferredType?: TDbView | null }
): Promise<{ picked: { id: string; type: TDbView | null; properties: TDbViewProperty[] | null } | null; all: TDbViewMeta[] }> {
  const empty = { picked: null, all: [] as TDbViewMeta[] }
  try {
    let viewsResp: any = await notion.views.list({
      database_id: databaseId,
      page_size: 100,
    })

    if ((!viewsResp?.results?.length) && opts?.fallbackDataSourceId) {
      debugLog(`[views] database_id query empty for ${databaseId}; retrying with data_source_id`)
      viewsResp = await notion.views
        .list({ data_source_id: opts.fallbackDataSourceId, page_size: 100 })
        .catch(() => null)
    }

    const refs: any[] = viewsResp?.results ?? []
    if (refs.length === 0) return empty

    let pickedEntry: { id: string; type: TDbView | null; properties: TDbViewProperty[] | null } | null = null
    const all: TDbViewMeta[] = []

    for (const ref of refs) {
      const viewId = ref?.id
      if (!viewId) continue
      const v: any = await notion.views.retrieve({ view_id: viewId }).catch(() => null)
      if (!v) continue
      const t = parseViewType(v?.type)
      if (!t) continue  // skip unsupported view types entirely
      const properties = parseViewProperties(v)
      const name: string | null = (v?.name as string) ?? (v?.title as string) ?? null
      const meta: TDbViewMeta = { id: viewId, type: t, name: name || null, properties }
      all.push(meta)
      if (!pickedEntry && !opts?.preferredType) {
        pickedEntry = { id: viewId, type: t, properties }
      }
      if (opts?.preferredType && t === opts.preferredType && !pickedEntry) {
        pickedEntry = { id: viewId, type: t, properties }
      }
    }

    if (!pickedEntry && all.length > 0) {
      const first = all[0]
      pickedEntry = { id: first.id, type: first.type, properties: first.properties }
    }

    debugLog(
      `[views] ${databaseId} → preferred=${opts?.preferredType ?? "-"} picked=${pickedEntry?.type ?? "none"} allViews=${all.length}`
    )
    return { picked: pickedEntry, all }
  } catch (e: any) {
    debugLog(`[views] fetchViewInfo failed for ${databaseId}: ${e?.message ?? e}`)
    return empty
  }
}

export async function getDatabase(
  databaseId: string,
  blockFormat?: any,
  opts?: { dbMeta?: any; fallbackDataSourceId?: string }
): Promise<TNotionDatabase | null> {
  const notion = getOfficialNotionClient()

  // Step 1: databases.retrieve to get last_edited_time, title, and data_sources.
  // Callers may pass a pre-fetched dbMeta to avoid a redundant retrieve call.
  let dbMeta: any = opts?.dbMeta ?? null
  if (!dbMeta) {
    try {
      dbMeta = await notion.databases.retrieve({ database_id: databaseId })
    } catch (error: any) {
      const code = error?.code ?? error?.status ?? ""
      console.error(`❌ Cannot retrieve database ${databaseId} [${code}]:`, error.message)
      return null
    }
  }

  const lastEdited: string = dbMeta.last_edited_time ?? "unknown"
  const title: string = dbMeta.title?.[0]?.plain_text ?? "Database"
  // For linked DB views, data_sources is [] — use fallbackDataSourceId from caller.
  const dataSourceId: string | undefined =
    dbMeta.data_sources?.[0]?.id ?? opts?.fallbackDataSourceId

  if (!dataSourceId) {
    // data_sources absent and no fallback: render an empty shell so the block
    // is visible rather than a generic placeholder.
    debugLog(
      `[getDatabase] no data_source for ${databaseId} (title="${title}") — rendering empty shell`
    )
    const emptySchemas: TDbPropertySchema[] = dbMeta.properties
      ? Object.entries(dbMeta.properties as Record<string, any>).map(([name, val]) => ({
          id: (val as any).id ?? name,
          name,
          type: ((val as any).type ?? "rich_text") as TDbPropertyType,
        }))
      : []
    const emptyView = detectView(blockFormat, pickGroupBy(emptySchemas)) ?? "table"
    return {
      id: databaseId,
      title,
      properties: emptySchemas,
      rows: [],
      view: emptyView,
      groupBy: null,
      groupOptions: null,
    }
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
        const viewInfo = await fetchViewInfo(databaseId, notion, {
          fallbackDataSourceId: opts?.fallbackDataSourceId,
          preferredType: explicitView,
        })
        const view: TDbView = explicitView ?? viewInfo.picked?.type ?? "table"
        const viewProperties = viewInfo.picked?.properties ?? null
        const views = viewInfo.all
        const defaultViewId = viewInfo.picked?.id

        const database: TNotionDatabase = {
          id: databaseId,
          title,
          properties: propertySchemas,
          rows,
          view,
          groupBy,
          groupOptions: groupOptions ?? null,
          viewProperties,
          views,
          defaultViewId,
        }

        debugLog(
          `✅ Fetched database "${title}" with ${rows.length} rows (view: ${database.view}${
            groupBy ? `, groupBy: ${groupBy}, ${groupOptions?.length ?? 0} options` : ""
          }${viewProperties ? `, viewProps: ${viewProperties.length}` : ""}${views.length > 1 ? `, views: ${views.length}` : ""})`
        )
        return database
      }
    )
  } catch (error: any) {
    console.error(`❌ Failed to fetch database ${databaseId}:`, error.message)
    return null
  }
}
