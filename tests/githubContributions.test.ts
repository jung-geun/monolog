import { parseGitHubContributionsHtml } from "src/libs/github/contributions"

describe("GitHub contribution calendar parsing", () => {
  it("extracts the configured user's yearly total and daily intensity", () => {
    const start = new Date("2025-01-01T00:00:00Z")
    const cells = Array.from({ length: 300 }, (_, index) => {
      const date = new Date(start)
      date.setUTCDate(start.getUTCDate() + index)
      const level = index % 5
      const count = index === 42 ? 17 : 0
      const dateKey = date.toISOString().slice(0, 10)
      return `
        <td data-level="${level}" class="ContributionCalendar-day" data-date="${dateKey}"></td>
        <tool-tip>${count === 0 ? "No contributions" : `${count} contributions`} on ${dateKey}.</tool-tip>
      `
    }).join("")
    const html = `<h2>1,234 contributions in the last year</h2>${cells}`

    const result = parseGitHubContributionsHtml(html, "configured-user")

    expect(result.username).toBe("configured-user")
    expect(result.total).toBe(1234)
    expect(result.days).toHaveLength(300)
    expect(result.days[42]).toMatchObject({ count: 17, level: 2 })
  })

  it("rejects an upstream response without a yearly calendar", () => {
    expect(() =>
      parseGitHubContributionsHtml("<h2>Profile unavailable</h2>", "configured-user")
    ).toThrow("yearly calendar")
  })
})
