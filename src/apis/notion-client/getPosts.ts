import { CONFIG } from "site.config"
import { TPosts, TPost } from "src/types"
import { getOfficialNotionClient } from "./notionClient"
import { createProxyRequestUrl } from "src/libs/utils/image/proxyUtils"
import { cacheStore, keys } from "src/libs/cache"

const POSTS_TTL_MS = Math.floor((CONFIG.revalidateTime / 2) * 1000)

/**
 * Fetch all posts from Notion database using official @notionhq/client
 */
export const getPosts = async (options?: { bypassCache?: boolean }): Promise<TPosts> => {
  const dataSourceId = process.env.NOTION_DATASOURCE_ID

  if (!dataSourceId) {
    console.error("❌ NOTION_DATASOURCE_ID is required")
    return []
  }

  const bypass = options?.bypassCache === true
  if (bypass) {
    await cacheStore.invalidate(keys.posts(dataSourceId))
  }

  return cacheStore.getOrSet(
    keys.posts(dataSourceId),
    POSTS_TTL_MS,
    () => fetchFromNotion(dataSourceId),
    { isCacheable: (posts) => posts.length > 0 }
  )
}

async function fetchFromNotion(dataSourceId: string): Promise<TPosts> {
  const notion = getOfficialNotionClient()

  let retryCount = 0
  const maxRetries = 3

  while (retryCount < maxRetries) {
    try {
      console.log(`📡 Fetching posts from Notion DataSource: ${dataSourceId}`)

      const response = await notion.dataSources.query({
        data_source_id: dataSourceId,
        page_size: 100,
      })

      console.log(`✅ Found ${response.results.length} posts`)

      const posts: TPosts = response.results.map((page: any) => {
        const post: any = { id: page.id }

        if (page.properties) {
          for (const [key, value] of Object.entries(page.properties)) {
            const prop = value as any
            switch (prop.type) {
              case "title":
                if (prop.title?.length > 0) {
                  post.title = prop.title[0].plain_text
                }
                break
              case "rich_text":
                if (prop.rich_text?.length > 0) {
                  if (key === "Summary" || key === "summary") {
                    post.summary = prop.rich_text[0].plain_text
                  } else {
                    post[key.toLowerCase()] = prop.rich_text[0].plain_text
                  }
                }
                break
              case "select":
                if (prop.select) {
                  if (key === "Status" || key === "status") {
                    post.status = [prop.select.name]
                  } else if (key === "Type" || key === "type") {
                    const typeValue = prop.select.name
                    const normalizedType =
                      typeValue.charAt(0).toUpperCase() + typeValue.slice(1).toLowerCase()
                    post.type = [normalizedType]
                  } else if (key === "Category" || key === "category") {
                    post.category = [prop.select.name]
                  }
                }
                break
              case "multi_select":
                if (prop.multi_select?.length > 0) {
                  if (key === "Tags" || key === "tags") {
                    post.tags = prop.multi_select.map((tag: any) => tag.name)
                  }
                }
                break
              case "date":
                if (prop.date) {
                  if (key === "Date" || key === "date") {
                    post.date = { start_date: prop.date.start }
                    if (prop.date.end) post.date.end_date = prop.date.end
                  }
                }
                break
              case "url":
                if (prop.url) {
                  if (key === "Slug" || key === "slug") {
                    post.slug = prop.url
                  } else if (key === "Thumbnail" || key === "thumbnail") {
                    post.thumbnail = createProxyRequestUrl(prop.url, {
                      pageId: page.id,
                      property: key,
                      propertyType: "url",
                      source: "postThumbnail",
                    })
                  }
                }
                break
              case "files":
                if (prop.files?.length > 0) {
                  if (key === "Thumbnail" || key === "thumbnail") {
                    const originalUrl =
                      prop.files[0].file?.url || prop.files[0].external?.url
                    post.thumbnail = createProxyRequestUrl(originalUrl, {
                      pageId: page.id,
                      property: key,
                      propertyType: "files",
                      source: "postThumbnail",
                    })
                  }
                }
                break
            }
          }
        }

        post.createdTime = page.created_time
        post.fullWidth = false

        return post as TPost
      })

      const publicPosts = posts.filter((post) => {
        const status = post.status?.[0]
        const isPublic = status === "Public" || status === "PublicOnDetail"
        const isPrivate = status === "Private"
        const isDev = process.env.NODE_ENV === "development"
        return isPublic || (isDev && isPrivate)
      })

      publicPosts.sort((a, b) => {
        const dateA = new Date(a.date?.start_date || a.createdTime || 0)
        const dateB = new Date(b.date?.start_date || b.createdTime || 0)
        return dateB.getTime() - dateA.getTime()
      })

      console.log(`✅ Filtered to ${publicPosts.length} public posts`)
      return publicPosts
    } catch (error: any) {
      retryCount++
      console.error(`❌ Notion API attempt ${retryCount}/${maxRetries} failed:`, error.message)

      if (error.code === "object_not_found") {
        console.error("❌ DataSource not found.")
        return []
      }

      if (retryCount === maxRetries) {
        console.error("❌ Failed to fetch posts after all retries")
        return []
      }

      const waitTime = Math.pow(2, retryCount) * 2000
      await new Promise((resolve) => setTimeout(resolve, waitTime))
    }
  }

  return []
}
