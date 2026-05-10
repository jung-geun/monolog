// Convert the Notion official-API `DateResponse` shape to the legacy
// `notion-types` `FormattedDate` shape that react-notion-x's Text component
// reads from `['d', ...]` decorations.
//
// Notion API:   { start: ISO8601, end: ISO8601 | null, time_zone: string | null }
// notion-types: { type, start_date, start_time?, end_date?, end_time?, time_zone? }

export type NotionDateResponse = {
  start: string
  end: string | null
  time_zone: string | null
}

export type FormattedDate = {
  type: "date" | "datetime" | "daterange" | "datetimerange"
  start_date: string
  start_time?: string
  end_date?: string
  end_time?: string
  time_zone?: string
}

function splitISO(iso: string): { date: string; time?: string } {
  if (!iso.includes("T")) return { date: iso }
  const [date, rest] = iso.split("T")
  // `rest` is "HH:MM:SS(.sss)?(Z|±HH:MM)" — RNX displays HH:MM only.
  return { date, time: rest.slice(0, 5) }
}

export function parseNotionDate(d: NotionDateResponse): FormattedDate {
  const start = splitISO(d.start)
  const end = d.end ? splitISO(d.end) : null

  let type: FormattedDate["type"]
  if (!end) {
    type = start.time ? "datetime" : "date"
  } else {
    type = start.time || end.time ? "datetimerange" : "daterange"
  }

  const result: FormattedDate = {
    type,
    start_date: start.date,
  }
  if (start.time) result.start_time = start.time
  if (end) {
    result.end_date = end.date
    if (end.time) result.end_time = end.time
  }
  if (d.time_zone) result.time_zone = d.time_zone

  return result
}

/**
 * Render a `FormattedDate` as a Korean-locale string. RNX's built-in
 * formatDate is English-only ("Nov 12, 2025"), so we precompute the visible
 * text in the translator and emit it as plain text on the date mention.
 */
export function formatDateKorean(d: FormattedDate): string {
  const formatOne = (date: string, time?: string) => {
    const [y, m, day] = date.split("-").map((s) => Number(s))
    if (!y || !m || !day) return date
    return time ? `${y}년 ${m}월 ${day}일 ${time}` : `${y}년 ${m}월 ${day}일`
  }
  const start = formatOne(d.start_date, d.start_time)
  if (d.type === "date" || d.type === "datetime") return start
  const end = formatOne(d.end_date ?? "", d.end_time)
  return `${start} → ${end}`
}
