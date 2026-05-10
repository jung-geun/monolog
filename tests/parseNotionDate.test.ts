/**
 * @jest-environment node
 *
 * Unit tests for parseNotionDate — converts Notion API DateResponse to
 * notion-types FormattedDate (the shape RNX `['d', ...]` decoration consumes).
 */

import { parseNotionDate } from "src/libs/utils/notion/parseNotionDate"

describe("parseNotionDate", () => {
  it("date-only without end → type=date", () => {
    expect(
      parseNotionDate({ start: "2026-05-10", end: null, time_zone: null })
    ).toEqual({ type: "date", start_date: "2026-05-10" })
  })

  it("datetime without end → type=datetime, HH:MM extracted", () => {
    expect(
      parseNotionDate({
        start: "2026-05-10T15:30:00.000Z",
        end: null,
        time_zone: "UTC",
      })
    ).toEqual({
      type: "datetime",
      start_date: "2026-05-10",
      start_time: "15:30",
      time_zone: "UTC",
    })
  })

  it("two date-only values → type=daterange", () => {
    expect(
      parseNotionDate({
        start: "2026-05-10",
        end: "2026-05-12",
        time_zone: null,
      })
    ).toEqual({
      type: "daterange",
      start_date: "2026-05-10",
      end_date: "2026-05-12",
    })
  })

  it("two datetime values → type=datetimerange", () => {
    expect(
      parseNotionDate({
        start: "2026-05-10T15:30:00.000Z",
        end: "2026-05-10T16:00:00.000Z",
        time_zone: null,
      })
    ).toEqual({
      type: "datetimerange",
      start_date: "2026-05-10",
      start_time: "15:30",
      end_date: "2026-05-10",
      end_time: "16:00",
    })
  })

  it("mixed (start datetime, end date-only) → datetimerange normalized", () => {
    expect(
      parseNotionDate({
        start: "2026-05-10T15:30:00.000Z",
        end: "2026-05-12",
        time_zone: null,
      })
    ).toEqual({
      type: "datetimerange",
      start_date: "2026-05-10",
      start_time: "15:30",
      end_date: "2026-05-12",
    })
  })

  it("offset timezone in ISO is truncated to HH:MM", () => {
    expect(
      parseNotionDate({
        start: "2026-05-10T09:00:00+09:00",
        end: null,
        time_zone: "Asia/Seoul",
      })
    ).toEqual({
      type: "datetime",
      start_date: "2026-05-10",
      start_time: "09:00",
      time_zone: "Asia/Seoul",
    })
  })
})
