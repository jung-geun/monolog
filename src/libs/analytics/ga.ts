export type AnalyticsEventParams = Record<string, string | number | boolean | undefined>


export const trackAnalyticsEvent = (eventName: string, parameters?: AnalyticsEventParams): void => {
  if (typeof window === "undefined" || typeof window.gtag !== "function") return
  window.gtag("event", eventName, parameters)
}

export const trackPageView = (url: string): void => {
  if (typeof window === "undefined") return

  const location = new URL(url, window.location.origin)
  trackAnalyticsEvent("page_view", {
    page_location: location.href,
    page_path: `${location.pathname}${location.search}`,
    page_title: document.title,
  })
}
