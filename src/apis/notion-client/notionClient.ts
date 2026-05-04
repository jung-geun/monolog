import { Client } from "@notionhq/client"
import { debugLog } from "src/libs/utils/logger"

export const getOfficialNotionClient = () => {
  const authToken = process.env.NOTION_TOKEN

  if (!authToken) {
    throw new Error('NOTION_TOKEN is required for official Notion API')
  }

  debugLog('🔑 Using Official Notion API (@notionhq/client)')
  return new Client({
    auth: authToken
  })
}
