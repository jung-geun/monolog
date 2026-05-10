import { getOfficialNotionClient } from "./notionClient"
import { cacheStore, keys } from "src/libs/cache"
import { debugLog } from "src/libs/utils/logger"

// 24h — user info (name, avatar) rarely changes; recordMap cache itself is
// keyed by last_edited_time so user data rotates with content updates.
const USER_TTL_MS = 24 * 60 * 60 * 1000

// `recordMap.notion_user[id].value` shape that RNX `case "u":` reads — see
// react-notion-x/build/index.js: it consumes `profile_photo`, `given_name`,
// `family_name`. Anything else can be omitted.
export type NotionUserValue = {
  id: string
  given_name: string
  family_name: string
  profile_photo: string | null
}

function splitName(full: string | null | undefined): {
  given: string
  family: string
} {
  if (!full) return { given: "", family: "" }
  const trimmed = full.trim()
  const space = trimmed.indexOf(" ")
  if (space === -1) return { given: trimmed, family: "" }
  return { given: trimmed.slice(0, space), family: trimmed.slice(space + 1) }
}

/**
 * Fetch a Notion user (avatar + name) with L1/L2 cache and request dedup.
 * `cacheStore.getOrSet` already handles thundering-herd; we additionally
 * downgrade fetch failures to a synthetic empty user so a single broken
 * mention does not crash the whole record map.
 */
export async function getUser(userId: string): Promise<NotionUserValue> {
  return cacheStore.getOrSet<NotionUserValue>(
    keys.user(userId),
    USER_TTL_MS,
    async () => {
      try {
        const notion = getOfficialNotionClient()
        const u: any = await notion.users.retrieve({ user_id: userId })
        const { given, family } = splitName(u?.name)
        return {
          id: userId,
          given_name: given,
          family_name: family,
          profile_photo: u?.avatar_url ?? null,
        }
      } catch (e: any) {
        // Fail soft: return a stub so recordMap synthesis can still proceed.
        // RNX `case "u":` returns null when profile_photo is missing, so the
        // mention will simply not render — same as the legacy behaviour.
        debugLog(
          `[getUser] users.retrieve failed for ${userId}: ${e?.message ?? e}`
        )
        return {
          id: userId,
          given_name: "",
          family_name: "",
          profile_photo: null,
        }
      }
    }
  )
}
