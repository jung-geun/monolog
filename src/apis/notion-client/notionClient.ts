import { Client } from "@notionhq/client"

/**
 * Get Official Notion API client instance (@notionhq/client)
 * Requires NOTION_TOKEN environment variable
 */
export const getOfficialNotionClient = () => {
  const authToken = process.env.NOTION_TOKEN
  
  if (!authToken) {
    throw new Error('NOTION_TOKEN is required for official Notion API')
  }
  
  console.log('🔑 Using Official Notion API (@notionhq/client)')
  return new Client({
    auth: authToken
  })
}
