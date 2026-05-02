import { NextApiRequest, NextApiResponse } from 'next'
import { getOfficialNotionClient } from 'src/apis/notion-client/notionClient'

/**
 * API to refresh expired image URLs from Notion
 * 
 * Usage: /api/refresh-image?blockId=<block-id>
 * 
 * This calls Notion API to get a fresh image URL for a block
 */
export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  const { blockId } = req.query

  if (!blockId || typeof blockId !== 'string') {
    return res.status(400).json({ error: 'Missing or invalid blockId parameter' })
  }

  try {
    const notion = getOfficialNotionClient()
    const block = await notion.blocks.retrieve({ block_id: blockId })

    // Extract image URL based on block type
    const blockType = (block as any).type
    const blockValue = (block as any)[blockType]

    if (!blockValue || typeof blockValue !== 'object') {
      return res.status(404).json({ error: 'Block value not found' })
    }

    let imageUrl: string | null = null

    // Handle different file types
    if (blockValue.type === 'file' && blockValue.file?.url) {
      imageUrl = blockValue.file.url
    } else if (blockValue.type === 'external' && blockValue.external?.url) {
      imageUrl = blockValue.external.url
    } else if (Array.isArray(blockValue.file) && blockValue.file[0]?.url) {
      imageUrl = blockValue.file[0].url
    }

    if (!imageUrl) {
      return res.status(404).json({ error: 'Image URL not found in block' })
    }

    return res.status(200).json({
      blockId,
      type: blockType,
      url: imageUrl,
    })
  } catch (error) {
    console.error('Error refreshing image URL:', error)
    return res.status(500).json({
      error: 'Failed to refresh image URL',
      details: error instanceof Error ? error.message : 'Unknown error',
    })
  }
}

export const config = {
  api: {
    bodyParser: true,
  },
}
