import { Client } from "@notionhq/client"
import { debugLog } from "src/libs/utils/logger"

export const getOfficialNotionClient = () => {
  const authToken = process.env.NOTION_TOKEN

  if (!authToken) {
    throw new Error('NOTION_TOKEN is required for official Notion API')
  }

  debugLog('🔑 Using Official Notion API (@notionhq/client)')
  // Pin the Notion-Version header explicitly. SDK 5.20.0 still defaults to
  // 2025-09-03; 2026-03-11 is the latest published version. Break impact
  // for our usage:
  //   - archived → in_trash : we read neither
  //   - transcription → meeting_notes : both unsupported by RNX (empty div)
  //   - position object on Append Block Children : we are read-only
  // So opting in is safe and aligns us with the current API surface (e.g.
  // Views API metadata fields).
  return new Client({
    auth: authToken,
    notionVersion: "2026-03-11",
  })
}
