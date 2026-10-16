import { useEffect } from "react"
import type { TPost } from "src/types"
import { trackAnalyticsEvent } from "src/libs/analytics/ga"
import { getReadingScrollRoot, observeReadingScroll } from "src/routes/Detail/PostDetail/scrollRoot"

export const ARTICLE_READ_MIN_ACTIVE_MS = 30_000
export const ARTICLE_READ_MIN_SCROLL_PERCENT = 75
const SCROLL_MILESTONES = [25, 50, 75, 100] as const

export const isArticleRead = (activeMs: number, maxScrollPercent: number): boolean =>
  activeMs >= ARTICLE_READ_MIN_ACTIVE_MS && maxScrollPercent >= ARTICLE_READ_MIN_SCROLL_PERCENT

const scrollPercent = (): number => {
  const root = getReadingScrollRoot()
  if (root instanceof HTMLElement && root.classList.contains("document-source") && !root.querySelector(".source-line")) return 0
  const scrollableHeight = root instanceof HTMLElement ? root.scrollHeight - root.clientHeight : document.documentElement.scrollHeight - window.innerHeight
  const position = root instanceof HTMLElement ? root.scrollTop : window.scrollY
  if (scrollableHeight <= 0) return 100
  return Math.min(100, Math.max(0, Math.round((position / scrollableHeight) * 100)))
}

export default function useArticleAnalytics(post?: Pick<TPost, "slug">): void {
  useEffect(() => {
    if (!post?.slug) return

    let activeMs = 0
    let lastActiveAt = document.visibilityState === "visible" ? Date.now() : null
    let maxScrollPercent = 0
    let readTracked = false
    let lastEngagementMs = 0
    const reachedMilestones: Partial<Record<(typeof SCROLL_MILESTONES)[number], true>> = {}

    const addActiveTime = () => {
      if (lastActiveAt === null) return
      activeMs += Date.now() - lastActiveAt
      lastActiveAt = Date.now()
    }

    const trackRead = () => {
      if (readTracked || !isArticleRead(activeMs, maxScrollPercent)) return
      readTracked = true
      trackAnalyticsEvent("article_read", {
        article_slug: post.slug,
        engagement_time_msec: activeMs,
        max_scroll_percent: maxScrollPercent,
      })
    }

    const trackProgress = () => {
      maxScrollPercent = Math.max(maxScrollPercent, scrollPercent())
      for (const milestone of SCROLL_MILESTONES) {
        if (maxScrollPercent < milestone || reachedMilestones[milestone]) continue
        reachedMilestones[milestone] = true
        trackAnalyticsEvent("article_progress", {
          article_slug: post.slug,
          percent: milestone,
        })
      }
      trackRead()
    }

    const flushEngagement = () => {
      addActiveTime()
      trackRead()
      const engagementDeltaMs = activeMs - lastEngagementMs
      if (engagementDeltaMs < 1_000) return
      lastEngagementMs = activeMs
      trackAnalyticsEvent("article_engagement", {
        article_slug: post.slug,
        engagement_time_msec: engagementDeltaMs,
        max_scroll_percent: maxScrollPercent,
      })
    }

    const onVisibilityChange = () => {
      if (document.visibilityState === "hidden") {
        flushEngagement()
        lastActiveAt = null
        return
      }
      lastActiveAt = Date.now()
    }

    const onInterval = () => {
      addActiveTime()
      trackProgress()
    }

    trackAnalyticsEvent("article_view", { article_slug: post.slug })
    trackProgress()
    const stopObserving = observeReadingScroll(trackProgress)
    window.addEventListener("pagehide", flushEngagement)
    document.addEventListener("visibilitychange", onVisibilityChange)
    const interval = window.setInterval(onInterval, 5_000)

    return () => {
      window.clearInterval(interval)
      stopObserving()
      window.removeEventListener("pagehide", flushEngagement)
      document.removeEventListener("visibilitychange", onVisibilityChange)
      flushEngagement()
    }
  }, [post?.slug])
}
