import { ExtendedRecordMap } from "notion-types"

// Block types that should be flattened (unsupported by react-notion-x)
const UNSUPPORTED_BLOCK_TYPES = [
  'synced_block',
  // 'audio' removed: react-notion-x and custom Audio component support audio blocks
  'breadcrumb',
  'table_of_contents',
  'transclusion_container',
] as const

/**
 * Flatten unsupported blocks by replacing them with their children
 */
function flattenUnsupportedBlocks(recordMap: ExtendedRecordMap): void {
  const blocksToRemove: string[] = []
  const replacements: Map<string, string[]> = new Map()
  const isDev = process.env.NODE_ENV !== 'production'

  // Find all unsupported blocks
  Object.entries(recordMap.block).forEach(([blockId, blockData]) => {
    const blockValue = blockData.value as any
    const blockType = blockValue.type

    if (UNSUPPORTED_BLOCK_TYPES.includes(blockType as any)) {
      const children = (blockValue.content as string[]) || []
      if (children.length > 0) {
        replacements.set(blockId, children)
      }
      blocksToRemove.push(blockId)

      // Log in dev/test mode
      if (isDev) {
        console.log(`🔄 [flattenUnsupportedBlocks] Flattening ${blockType} block: ${blockId} (${children.length} children)`)
      }
    }
  })

  // Replace unsupported blocks with their children in parent content arrays
  Object.entries(recordMap.block).forEach(([blockId, blockData]) => {
    const blockValue = blockData.value as any
    const content = blockValue.content as string[] | undefined
    if (content && content.length > 0) {
      const newContent: string[] = []
      for (const childId of content) {
        if (replacements.has(childId)) {
          // Replace unsupported block with its children
          newContent.push(...replacements.get(childId)!)
        } else {
          // Keep the block
          newContent.push(childId)
        }
      }
      blockData.value.content = newContent
    }
  })

  // Remove unsupported blocks from recordMap
  blocksToRemove.forEach(blockId => {
    delete recordMap.block[blockId]
  })

  // Log summary
  if (isDev && blocksToRemove.length > 0) {
    console.log(`✅ [flattenUnsupportedBlocks] Flattened ${blocksToRemove.length} unsupported blocks`)
  } else if (!isDev && blocksToRemove.length > 0) {
    console.log(`[flattenUnsupportedBlocks] Processed ${blocksToRemove.length} unsupported blocks`)
  }
}

/**
 * Optimize record map by removing unnecessary data to reduce bundle size
 */
export const optimizeRecordMap = (recordMap: ExtendedRecordMap | null | undefined): ExtendedRecordMap | null => {
  if (!recordMap) {
    return null
  }

  const optimized = { ...recordMap }

  // Flatten unsupported blocks before optimization
  flattenUnsupportedBlocks(optimized)

  // Remove preview images to reduce size
  if (optimized.preview_images) {
    optimized.preview_images = {}
  }

  // Remove signed URLs from blocks to reduce size
  if (optimized.signed_urls) {
    optimized.signed_urls = {}
  }

  // Clean up unnecessary properties from blocks
  if (optimized.block) {
    Object.keys(optimized.block).forEach(blockId => {
      const block = optimized.block[blockId]
      if (block?.value) {
        // Remove large properties that are not essential for rendering
        const value = { ...block.value }

        // Remove file properties if they exist and are large
        if (value.properties && typeof value.properties === 'object') {
          Object.keys(value.properties).forEach(prop => {
            const property = value.properties[prop]
            // If property is an array with file references, limit it
            if (Array.isArray(property) && property.length > 0) {
              // Keep only essential data for files
              value.properties[prop] = property.map(item => {
                if (Array.isArray(item) && item.length > 1) {
                  // Keep only the first two elements (usually text and formatting)
                  return item.slice(0, 2)
                }
                return item
              })
            }
          })
        }

        optimized.block[blockId] = {
          ...block,
          value
        }
      }
    })
  }

  return optimized
}
