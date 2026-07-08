/**
 * @jest-environment node
 */

import { checkVisitRateLimit } from "src/libs/utils/visits/rateLimit"

describe("checkVisitRateLimit", () => {
  beforeEach(() => {
    jest.useFakeTimers()
    jest.setSystemTime(new Date("2026-01-01T00:00:00.000Z"))
  })

  afterEach(() => {
    jest.useRealTimers()
  })

  it("allows 60 requests per minute and resets after the window expires", () => {
    const results = Array.from({ length: 60 }, () => checkVisitRateLimit("ip-1").ok)

    expect(results).toEqual(Array(60).fill(true))
    expect(checkVisitRateLimit("ip-1")).toEqual({ ok: false })

    jest.advanceTimersByTime(60_001)

    expect(checkVisitRateLimit("ip-1")).toEqual({ ok: true })
  })
})
