import { ExtendedRecordMap } from "notion-types"
import { getOfficialNotionClient } from "./notionClient"
import { optimizeRecordMap } from "src/libs/utils/notion/optimizeRecordMap"
import { unwrapBlock, getBlockById } from "src/libs/utils/notion/unwrapBlock"
import { TPosts } from "src/types"
import { cacheStore, keys } from "src/libs/cache"
import { CONFIG } from "site.config"
import { debugLog } from "src/libs/utils/logger"

const RECORD_MAP_TTL_MS = CONFIG.revalidateTime * 1000

/**
 * Convert Notion presigned URLs to our proxy URLs to prevent expiration
 * This ensures images remain accessible even after the original signed URL expires
 */
function convertPresignedUrlsToProxy(recordMap: ExtendedRecordMap): ExtendedRecordMap {
  // Process all blocks to find and convert image URLs
  Object.entries(recordMap.block).forEach(([blockId, blockData]) => {
    const block = unwrapBlock(blockData)
    if (!block) return

    // Handle image blocks
    if (block.type === 'image' && block.properties?.source) {
      const sources = block.properties.source
      if (Array.isArray(sources) && sources.length > 0) {
        sources.forEach((source, index) => {
          if (Array.isArray(source) && source.length > 0) {
            const url = source[0]
            if (typeof url === 'string' && shouldProxyUrl(url)) {
              source[0] = `/api/image-proxy?url=${encodeURIComponent(url)}`
            }
          }
        })
      }
    }

    // Handle cover images
    if (block.format?.page_cover) {
      const coverUrl = block.format.page_cover
      if (typeof coverUrl === 'string' && shouldProxyUrl(coverUrl)) {
        block.format.page_cover = `/api/image-proxy?url=${encodeURIComponent(coverUrl)}`
      }
    }

    // Handle page icons (if they're images)
    if (block.format?.page_icon) {
      const iconUrl = block.format.page_icon
      if (typeof iconUrl === 'string' && shouldProxyUrl(iconUrl)) {
        block.format.page_icon = `/api/image-proxy?url=${encodeURIComponent(iconUrl)}`
      }
    }

    // Handle block decorations (inline images)
    if (block.properties) {
      Object.values(block.properties).forEach((prop: any) => {
        if (Array.isArray(prop)) {
          prop.forEach((item: any) => {
            if (Array.isArray(item) && item.length > 0) {
              const maybeUrl = item[0]
              if (typeof maybeUrl === 'string' && shouldProxyUrl(maybeUrl)) {
                item[0] = `/api/image-proxy?url=${encodeURIComponent(maybeUrl)}`
              }
            }
          })
        }
      })
    }
  })

  return recordMap
}

/**
 * Check if a URL should be proxied (S3 presigned URLs)
 */
function shouldProxyUrl(url: string): boolean {
  if (!url || typeof url !== 'string') return false

  // Proxy S3 presigned URLs
  if (url.includes('amazonaws.com') && url.includes('X-Amz-Signature')) {
    return true
  }

  // Proxy Notion's prod-files-secure URLs
  if (url.startsWith('https://prod-files-secure.s3.us-west-2.amazonaws.com')) {
    return true
  }

  return false
}


/**
 * Recursively fetch child blocks
 */
async function fetchChildBlocks(blockId: string, notion: any, recordMap: ExtendedRecordMap, allPosts?: TPosts): Promise<string[]> {
  try {
    const childIds: string[] = []

    // Notion children.list is paginated. Iterate through pages
    let cursor: string | undefined = undefined
    let fetched = 0
    const MAX_FETCH = 5000 // safety cap to avoid runaway fetching

    do {
      const resp: any = await notion.blocks.children.list({
        block_id: blockId,
        page_size: 100,
        start_cursor: cursor,
      })

      for (const block of resp.results) {
        childIds.push(block.id)
        // process each block (this may in turn fetch deeper children)
        await processBlock(block, blockId, notion, recordMap, allPosts)
      }

      fetched += resp.results.length
      if (fetched >= MAX_FETCH) {
        console.warn(`Reached max child fetch limit for block ${blockId} (${MAX_FETCH}), stopping pagination`)
        break
      }

      cursor = resp.has_more ? resp.next_cursor : undefined
    } while (cursor)

    if (childIds.length > 0) {
      debugLog(`📦 [fetchChildBlocks] Fetched ${childIds.length} children for block ${blockId}`)
    }

    return childIds
  } catch (error) {
    console.error(`Failed to fetch children for block ${blockId}:`, error)
    return []
  }
}

/**
 * Convert rich text array to notion-types format with decorations
 */
function convertRichText(richTextArray: any[]): any[][] {
  if (!richTextArray || !Array.isArray(richTextArray) || richTextArray.length === 0) return []

  return richTextArray.map((rt: any) => {
    let text = ''
    const decorations: any[][] = []

    if (rt.type === 'equation') {
      text = rt.equation?.expression || ''
      // Inline equation decoration must be ['e', expression]
      decorations.push(['e', text])
    } else if (rt.type === 'text') {
      text = rt.text?.content || rt.plain_text || ''
    } else {
      text = rt.plain_text || ''
    }

    if (rt.annotations) {
      if (rt.annotations.bold) decorations.push(['b'])
      if (rt.annotations.italic) decorations.push(['i'])
      if (rt.annotations.strikethrough) decorations.push(['s'])
      if (rt.annotations.underline) decorations.push(['_'])
      if (rt.annotations.code) decorations.push(['c'])
      if (rt.annotations.color && rt.annotations.color !== 'default') {
        decorations.push(['h', rt.annotations.color])
      }
    }

    if (rt.href) {
      decorations.push(['a', rt.href])
    }

    // Return format: [text, [decorations]] or [text] if no decorations
    if (decorations.length > 0) {
      return [text, decorations]
    }
    return [text]
  })
}

/**
 * Process a single block and add it to recordMap
 */
async function processBlock(block: any, parentId: string, notion: any, recordMap: ExtendedRecordMap, allPosts?: TPosts): Promise<void> {
  const properties: any = {}
  const format: any = {}

  if (block.type && block[block.type]) {
    const blockData = block[block.type]

    // Handle blocks with rich_text (paragraph, headings, lists, quotes, callouts, toggles, etc.)
    if (blockData.rich_text && Array.isArray(blockData.rich_text)) {
      properties.title = convertRichText(blockData.rich_text)
    }

    // Handle specific block types
    switch (block.type) {
      case 'link_to_page':
        // Link to page block - convert to text with link decoration
        const linkToPageData = blockData
        if (linkToPageData) {
          const linkedPageId = linkToPageData.page_id || linkToPageData.database_id
          const linkedType = linkToPageData.type // 'page' or 'database'

          if (linkedPageId) {
            // Try to find the linked page in recordMap to get its title
            let pageTitle = linkedType === 'database' ? 'Database' : 'Page'

            // Search for the page in recordMap
            const linkedPageBlock = getBlockById(recordMap, linkedPageId)
            if (linkedPageBlock) {
              // Extract title from properties
              const titleProp = linkedPageBlock.properties?.title
              if (titleProp && Array.isArray(titleProp) && titleProp.length > 0) {
                pageTitle = titleProp[0][0] || pageTitle
              }
            }

            // Find the linked post in allPosts to get its slug
            const linkedPost = allPosts?.find((post) => post.id === linkedPageId)
            // Create link decoration - use slug if available, otherwise fallback to page ID
            const pageUrl = linkedPost?.slug
              ? `/${linkedPost.slug}`
              : linkedType === 'database'
                ? `/database/${linkedPageId}`
                : `/[page-id]?id=${linkedPageId}`
            pageTitle = (linkedPost ? linkedPost.title : pageTitle) || pageTitle

            properties.title = [[pageTitle, [['a', pageUrl]]]]

            // console.log(`🔗 [link_to_page] Converted to text link:`, {
            //   blockId: block.id,
            //   linkedPageId,
            //   linkedType,
            //   pageTitle,
            //   pageUrl,
            //   slug: linkedPost?.slug,
            // })
          }
        }
        break

      case 'code':
        if (blockData.rich_text && Array.isArray(blockData.rich_text)) {
          properties.title = convertRichText(blockData.rich_text)
          properties.language = [[blockData.language || 'plain text']]
        }
        if (blockData.caption && Array.isArray(blockData.caption) && blockData.caption.length > 0) {
          properties.caption = convertRichText(blockData.caption)
        }
        break

      case 'image':
        const imageUrl = blockData.file?.url || blockData.external?.url
        debugLog('🖼️ [processBlock] Image block found:', block.id, imageUrl)
        debugLog('🖼️ [processBlock] Full block data:', blockData)
        if (imageUrl) {
          debugLog('🖼️ Image URL from Notion API:', imageUrl)

          properties.source = [[imageUrl]]

          // Add format for image display  
          format.display_source = imageUrl
        }
        if (blockData.caption && blockData.caption.length > 0) {
          properties.caption = convertRichText(blockData.caption)
        }
        break

      case 'video':
      case 'file':
      case 'pdf':
        const fileUrl = blockData.file?.url || blockData.external?.url
        if (fileUrl) {
          properties.source = [[fileUrl]]
          if (blockData.caption && blockData.caption.length > 0) {
            properties.caption = convertRichText(blockData.caption)
          }
        }
        break

      case 'bookmark':
      case 'link_preview':
        if (blockData.url) {
          properties.link = [[blockData.url]]
          properties.title = blockData.caption && blockData.caption.length > 0
            ? convertRichText(blockData.caption)
            : [[blockData.url]]
        }
        break

      case 'equation':
        if (blockData.expression) {
          properties.title = [[blockData.expression]]
        }
        break

      case 'divider':
        // Divider has no properties
        break

      case 'callout':
        if (blockData.icon) {
          format.page_icon = blockData.icon.emoji || blockData.icon.external?.url || blockData.icon.file?.url
        }
        break

      case 'to_do':
        if (typeof blockData.checked !== 'undefined') {
          properties.checked = [[blockData.checked ? 'Yes' : 'No']]
        }
        break

      case 'column_list':
      case 'column':
        // These are container blocks, handled by content
        break

      case 'table':
        if (blockData.table_width) {
          format.table_width = blockData.table_width

          // Generate table_block_column_order for react-notion-x to render columns
          const columnOrder: string[] = []
          for (let i = 0; i < blockData.table_width; i++) {
            columnOrder.push(`cell_${i}`)
          }
          format.table_block_column_order = columnOrder
        }
        if (blockData.has_column_header) {
          format.table_block_column_header = true
        }
        if (blockData.has_row_header) {
          format.table_block_row_header = true
        }
        break

      case 'table_row':
        if (blockData.cells && Array.isArray(blockData.cells)) {
          // Convert table cells
          blockData.cells.forEach((cell: any[], index: number) => {
            if (cell && cell.length > 0) {
              properties[`cell_${index}`] = convertRichText(cell)
            }
          })
        }
        break

      case 'child_database':
        // Database block - store metadata for placeholder rendering
        debugLog('📊 [getRecordMap] Found child_database block:', block.id)
        if (blockData.title) {
          properties.title = convertRichText(blockData.title)
        }
        // Store database ID for future custom rendering (Option 3)
        // Use block.id as database_id (the child_database block itself)
        if (block.id) {
          format.database_id = block.id
        }
        break

      case 'synced_block':
        // Synced block - children will be fetched automatically via has_children
        // Store synced_from reference if available (points to original block)
        debugLog('📋 [synced_block] Found:', {
          id: block.id,
          has_children: block.has_children,
          synced_from: blockData.synced_from,
        })
        if (blockData.synced_from) {
          format.synced_from = blockData.synced_from
        }
        break

      case 'audio':
        // Audio block - similar to video/file
        const audioUrl = blockData.file?.url || blockData.external?.url
        if (audioUrl) {
          properties.source = [[audioUrl]]
          // Add format for audio display
          format.display_source = audioUrl
          debugLog('🎵 [getRecordMap] Audio block found:', block.id, audioUrl)
        }
        if (blockData.caption && blockData.caption.length > 0) {
          properties.caption = convertRichText(blockData.caption)
        }
        break

      case 'breadcrumb':
      case 'table_of_contents':
      case 'transclusion_container':
        // Container blocks - no specific properties needed
        // Children will be fetched automatically via has_children
        break
    }

    // Handle color for all block types
    if (blockData.color && blockData.color !== 'default') {
      format.block_color = blockData.color
    }
  }

  // Map Official API block types to notion-types format
  const typeMapping: Record<string, string> = {
    'paragraph': 'text',
    'heading_1': 'header',
    'heading_2': 'sub_header',
    'heading_3': 'sub_sub_header',
    'bulleted_list_item': 'bulleted_list',
    'numbered_list_item': 'numbered_list',
    'to_do': 'to_do',
    'toggle': 'toggle',
    'code': 'code',
    'quote': 'quote',
    'callout': 'callout',
    'divider': 'divider',
    'image': 'image',
    'video': 'video',
    'file': 'file',
    'pdf': 'pdf',
    'bookmark': 'bookmark',
    'equation': 'equation',
    'column_list': 'column_list',
    'column': 'column',
    'table': 'table',
    'table_row': 'table_row',
    'embed': 'embed',
    'link_preview': 'bookmark',
    'child_database': 'collection_view_page', // Temporary: use collection_view_page for placeholder
    // Additional block types
    'synced_block': 'synced_block',
    'link_to_page': 'text', // Convert link_to_page to text with link decoration
    'audio': 'audio',
    'breadcrumb': 'breadcrumb',
    'table_of_contents': 'table_of_contents',
    'transclusion_container': 'transclusion_container',
  }

  const mappedType = typeMapping[block.type] || block.type

  const blockValue: any = {
    id: block.id,
    version: 1,
    type: mappedType,
    properties,
    created_time: block.created_time,
    last_edited_time: block.last_edited_time,
    parent_id: parentId,
    parent_table: 'block',
    alive: true,
  }

  // Add format if not empty
  if (Object.keys(format).length > 0) {
    blockValue.format = format
  }

  // Fetch children if has_children is true
  if (block.has_children) {
    const childIds = await fetchChildBlocks(block.id, notion, recordMap, allPosts)
    if (childIds.length > 0) {
      blockValue.content = childIds
    }
  }

  recordMap.block[block.id] = {
    role: 'reader',
    value: blockValue,
  }
}

/**
 * Get page record map for rendering with react-notion-x
 * Uses official @notionhq/client API
 * 
 * Note: This returns a compatible structure for react-notion-x
 */
export const getRecordMap = async (pageId: string, allPosts?: TPosts): Promise<ExtendedRecordMap | null> => {
  const notion = getOfficialNotionClient()

  // Peek at last_edited_time to build a version-aware cache key.
  // This is a lightweight single API call; the heavy block-tree fetch is skipped on hit.
  let lastEdited = "unknown"
  try {
    const meta = await notion.pages.retrieve({ page_id: pageId })
    lastEdited = (meta as any).last_edited_time ?? "unknown"
  } catch {
    // fallback: use pageId-only key (may serve stale content)
  }

  const cached = await cacheStore.get<ExtendedRecordMap>(keys.recordMap(pageId, lastEdited))
  if (cached) {
    debugLog(`✅ Cache hit for recordMap: ${pageId}`)
    return cached
  }

  const result = await fetchRecordMap(pageId, lastEdited, allPosts, notion)
  if (result) {
    await cacheStore.set(keys.recordMap(pageId, lastEdited), result, RECORD_MAP_TTL_MS)
  }
  return result
}

async function fetchRecordMap(
  pageId: string,
  lastEdited: string,
  allPosts: TPosts | undefined,
  notion: any
): Promise<ExtendedRecordMap | null> {
  let retryCount = 0
  const maxRetries = 3

  while (retryCount < maxRetries) {
    try {
      debugLog(`📡 Fetching page content for ${pageId}`)

      // Get page metadata
      const page = await notion.pages.retrieve({ page_id: pageId })

      // Get page blocks (content)
      // Fetch all top-level blocks for the page (paginated)
      const allBlocks: any[] = []
      let topCursor: string | undefined = undefined
      do {
        const pageResp: any = await notion.blocks.children.list({
          block_id: pageId,
          page_size: 100,
          start_cursor: topCursor,
        })
        allBlocks.push(...pageResp.results)
        topCursor = pageResp.has_more ? pageResp.next_cursor : undefined
      } while (topCursor)

      const blocks = { results: allBlocks }
      debugLog(`✅ Retrieved page ${pageId} with ${blocks.results.length} blocks`)

      // Transform to ExtendedRecordMap format for react-notion-x compatibility
      const recordMap: ExtendedRecordMap = {
        block: {},
        collection: {},
        collection_view: {},
        notion_user: {},
        collection_query: {},
        signed_urls: {},
      }

      // Add page block
      recordMap.block[pageId] = {
        role: 'reader',
        value: {
          id: pageId,
          version: 1,
          type: 'page',
          properties: (page as any).properties || {},
          created_time: (page as any).created_time,
          last_edited_time: (page as any).last_edited_time,
          parent_id: '',
          parent_table: 'space',
          alive: true,
          content: blocks.results.map((block: any) => block.id),
        } as any,
      }

      // Process all child blocks (including nested children)
      for (const block of blocks.results) {
        await processBlock(block, pageId, notion, recordMap, allPosts)
      }

      // Optimize record map and flatten synced blocks
      const optimizedRecordMap = optimizeRecordMap(recordMap)

      return optimizedRecordMap

    } catch (error: any) {
      retryCount++
      console.error(`❌ getRecordMap attempt ${retryCount}/${maxRetries} failed for ${pageId}:`, error.message)

      if (error.code === 'object_not_found') {
        console.error(`❌ Page ${pageId} not found or not accessible`)
        return null
      }

      if (retryCount === maxRetries) {
        console.error(`❌ getRecordMap failed for ${pageId} after all retries`)
        return null
      }

      // Exponential backoff
      const waitTime = Math.pow(2, retryCount) * 1500
      debugLog(`⏳ Waiting ${waitTime / 1000} seconds before retry...`)
      await new Promise(resolve => setTimeout(resolve, waitTime))
    }
  }

  return null
}
