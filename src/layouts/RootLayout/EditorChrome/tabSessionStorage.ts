import type { Tab, TabKind } from "./RouteChromeContext"

export const TAB_CONSENT_KEY = "monolog.editor-tabs.consent.v1"
export const TAB_SESSION_KEY = "monolog.editor-tabs.session.v1"
export const CLOSED_POST_LIMIT = 20

export const README_TAB: Tab = {
  id: "readme",
  kind: "readme",
  label: "README.md",
  href: "/",
  closeable: false,
}

const kinds: TabKind[] = ["post", "category", "series", "graph", "about", "page"]

// Require root-relative URLs; backslashes can be interpreted as host separators.
export const isLocalTabHref = (href: string): boolean => {
  if (!href.startsWith("/") || href.startsWith("//") || /[\\\u0000-\u0020\u007f]/.test(href)) return false
  try {
    const base = "https://monolog.invalid"
    return new URL(href, base).origin === base
  } catch {
    return false
  }
}

const parseTab = (value: unknown): Tab | null => {
  if (!value || typeof value !== "object") return null
  const tab = value as Record<string, unknown>
  if (typeof tab.id !== "string" || typeof tab.kind !== "string" || typeof tab.label !== "string" || typeof tab.href !== "string") return null
  if (tab.kind === "readme") {
    return tab.id === "readme" && tab.href === "/" && tab.label === "README.md"
      ? README_TAB : null
  }
  if (!kinds.includes(tab.kind as TabKind) || !tab.label.trim() || !isLocalTabHref(tab.href) || tab.href === "/" || tab.id !== tab.href.split("#", 1)[0]) return null
  return { id: tab.id, kind: tab.kind as TabKind, label: tab.label, href: tab.href, closeable: true }
}

export type StoredTabSession = { tabs: Tab[]; closedPosts: Tab[] }

export const parseTabSession = (raw: string): StoredTabSession | null => {
  try {
    const value = JSON.parse(raw)
    if (!value || value.version !== 1 || !Array.isArray(value.tabs) || !Array.isArray(value.closedPosts) || value.closedPosts.length > CLOSED_POST_LIMIT) return null
    const tabs = value.tabs.map(parseTab) as (Tab | null)[]
    const closedPosts = value.closedPosts.map(parseTab) as (Tab | null)[]
    if (tabs.some((tab) => !tab) || closedPosts.some((tab) => !tab || tab.kind !== "post")) return null
    const validTabs = tabs as Tab[]
    const validClosedPosts = closedPosts as Tab[]
    if (new Set(validTabs.map((tab) => tab.id)).size !== validTabs.length || new Set(validClosedPosts.map((tab) => tab.id)).size !== validClosedPosts.length) return null
    return { tabs: validTabs, closedPosts: validClosedPosts }
  } catch {
    return null
  }
}

export const serializeTabSession = (session: StoredTabSession): string => {
  return JSON.stringify({
    version: 1,
    tabs: session.tabs.map(({ id, kind, label, href }) => ({ id, kind, label, href })),
    closedPosts: session.closedPosts.map(({ id, kind, label, href }) => ({ id, kind, label, href })),
  })
}
