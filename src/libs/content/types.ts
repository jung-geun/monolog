import type { ExtendedRecordMap } from "notion-types"
import type { TPost, TPosts } from "src/types"

export type RegistryEntry = {
  id: string
  lastEdited: string
  metadataHash: string
  bodyCheckedAt?: number
  slugHistory: string[]
  warning?: string
  post?: TPost
  future?: TPost
  recordMap?: ExtendedRecordMap
}

export type ContentEffects = {
  id: string
  revision: number
  paths: string[]
  upserted: TPosts
  deletedIds: string[]
  graphDone: boolean
}
export type ContentNotification = {
  id: string
  kind: "discord" | "indexnow"
  payload: string[]
  attempts: number
  nextAttemptAt: number
}
export type ContentState = {
  version: 1
  revision: number
  initialized: boolean
  lastReconciledAt: number
  lastFullAt: number
  entries: Record<string, RegistryEntry>
  pending: Record<string, { attempts: number; nextAttemptAt: number }>
  events: Record<string, number>
  effects: ContentEffects[]
  notifications: ContentNotification[]
}
export type ContentSnapshot = {
  posts: TPosts
  recordMaps: Record<string, ExtendedRecordMap>
  redirects: Record<string, string>
  revision: number
}
export type GraphDelta = {
  revision: number
  upserted: TPosts
  deletedIds: string[]
}
export const emptyContentState = (): ContentState => ({
  version: 1, revision: 0, initialized: false, lastReconciledAt: 0,
  lastFullAt: 0, entries: {}, pending: {}, events: {}, effects: [], notifications: [],
})
