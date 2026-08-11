import {
  ARTICLE_READ_MIN_ACTIVE_MS,
  ARTICLE_READ_MIN_SCROLL_PERCENT,
  isArticleRead,
} from "src/hooks/useArticleAnalytics"
import { trackAnalyticsEvent, trackPageView } from "src/libs/analytics/ga"

describe("article read eligibility", () => {
  it("requires both meaningful active time and scroll progress", () => {
    expect(isArticleRead(ARTICLE_READ_MIN_ACTIVE_MS - 1, 100)).toBe(false)
    expect(isArticleRead(ARTICLE_READ_MIN_ACTIVE_MS, ARTICLE_READ_MIN_SCROLL_PERCENT - 1)).toBe(false)
    expect(isArticleRead(ARTICLE_READ_MIN_ACTIVE_MS, ARTICLE_READ_MIN_SCROLL_PERCENT)).toBe(true)
  })
})

describe("GA4 event dispatch", () => {
  let gtagMock: jest.Mock

  beforeEach(() => {
    gtagMock = jest.fn()
    Object.defineProperty(window, "gtag", { configurable: true, value: gtagMock })
  })

  afterEach(() => {
    Object.defineProperty(window, "gtag", { configurable: true, value: undefined })
  })

  it("sends only explicit privacy-safe event parameters", () => {
    trackAnalyticsEvent("article_read", {
      article_slug: "example-post",
      engagement_time_msec: 30_000,
      max_scroll_percent: 75,
    })

    expect(gtagMock).toHaveBeenCalledWith("event", "article_read", {
      article_slug: "example-post",
      engagement_time_msec: 30_000,
      max_scroll_percent: 75,
    })
  })

  it("records the route path and title for client-side page views", () => {
    document.title = "Analytics test"
    trackPageView("/series?sort=recent")

    expect(gtagMock).toHaveBeenCalledWith("event", "page_view", {
      page_location: "http://localhost/series?sort=recent",
      page_path: "/series?sort=recent",
      page_title: "Analytics test",
    })
  })
})
