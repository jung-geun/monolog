import { NextApiRequest, NextApiResponse } from 'next'
import { getOfficialNotionClient } from 'src/apis/notion-client/notionClient'
import { getIpHash, checkRefreshImageRateLimit } from 'src/libs/utils/security'

const NOTION_TIMEOUT_MS = 8_000

function withTimeout<T>(p: Promise<T>, ms: number): Promise<T> {
  return Promise.race([
    p,
    new Promise<T>((_, reject) =>
      setTimeout(() => reject(new Error(`Notion request timed out after ${ms}ms`)), ms)
    ),
  ])
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (!checkRefreshImageRateLimit(getIpHash(req)).ok) {
    return res.status(429).json({ error: 'too many requests' })
  }

  const { blockId } = req.query

  if (!blockId || typeof blockId !== 'string') {
    return res.status(400).json({ error: 'Missing or invalid blockId parameter' })
  }

  try {
    const notion = getOfficialNotionClient()
    const block = await withTimeout(
      notion.blocks.retrieve({ block_id: blockId }),
      NOTION_TIMEOUT_MS
    )

    const blockType = (block as any).type
    const blockValue = (block as any)[blockType]

    if (!blockValue || typeof blockValue !== 'object') {
      return res.status(404).json({ error: 'Block value not found' })
    }

    let imageUrl: string | null = null

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
    return res.status(500).json({ error: 'Failed to refresh image URL' })
  }
}

export const config = {
  api: {
    bodyParser: true,
  },
}
