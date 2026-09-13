export type GitHubContributionDay = {
  date: string
  count: number
  level: number
}

export type GitHubContributionData = {
  username: string
  total: number
  days: GitHubContributionDay[]
}

const MIN_EXPECTED_DAYS = 300

export function parseGitHubContributionsHtml(
  html: string,
  username: string
): GitHubContributionData {
  const daysByDate = new Map<string, GitHubContributionDay>()
  const cellPattern =
    /<td\b([^>]*\bdata-date="[^"]+"[^>]*)>\s*<\/td>\s*<tool-tip\b[^>]*>([\s\S]*?)<\/tool-tip>/gi

  for (const match of html.matchAll(cellPattern)) {
    const attributes = match[1]
    const date = attributes.match(/\bdata-date="([^"]+)"/i)?.[1]
    const levelValue = attributes.match(/\bdata-level="([0-4])"/i)?.[1]
    if (!date || levelValue === undefined) continue

    const tooltip = match[2]
      .replace(/<[^>]+>/g, " ")
      .replace(/\s+/g, " ")
      .trim()
    const countMatch = tooltip.match(/([\d,]+) contributions?/i)
    const count = countMatch ? Number(countMatch[1].replace(/,/g, "")) : 0

    daysByDate.set(date, {
      date,
      count: Number.isFinite(count) ? count : 0,
      level: Number(levelValue),
    })
  }

  const days = Array.from(daysByDate.values()).sort((a, b) =>
    a.date.localeCompare(b.date)
  )
  if (days.length < MIN_EXPECTED_DAYS) {
    throw new Error("GitHub contribution payload did not contain a yearly calendar")
  }

  const totalMatch = html.match(
    /([\d,]+)\s+contributions?\s+in the last year/i
  )
  const total = totalMatch
    ? Number(totalMatch[1].replace(/,/g, ""))
    : days.reduce((sum, day) => sum + day.count, 0)

  return { username, total, days }
}
