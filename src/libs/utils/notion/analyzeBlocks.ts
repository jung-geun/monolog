import type { BlockObjectResponse, RichTextItemResponse } from '@notionhq/client/build/src/api-endpoints'
import type { getOfficialNotionClient } from 'src/apis/notion-client/notionClient'

type NotionClient = ReturnType<typeof getOfficialNotionClient>

export type BlockSummary = {
  totalBlocks: number
  types: Record<string, number>
  inlineMath: Array<{ blockId: string; type: string }>
  images: Array<{
    blockId: string
    type: 'file' | 'external'
    source?: string
    caption?: string
  }>
}

/**
 * Traverse a Notion page tree and collect aggregate block information for diagnostics.
 */
export async function summarizeBlockTypes(notion: NotionClient, pageId: string): Promise<BlockSummary> {
  const summary: BlockSummary = {
    totalBlocks: 0,
    types: {},
    inlineMath: [],
    images: [],
  }

  const queue: string[] = [pageId]

  while (queue.length > 0) {
    const blockId = queue.shift() as string
    let cursor: string | undefined

    do {
      const resp = await notion.blocks.children.list({
        block_id: blockId,
        page_size: 100,
        start_cursor: cursor,
      })

      resp.results.forEach((block) => {
        if (!isBlockObjectResponse(block)) {
          return
        }
        summary.totalBlocks += 1
        summary.types[block.type] = (summary.types[block.type] ?? 0) + 1

        if (containsInlineEquation(block)) {
          summary.inlineMath.push({ blockId: block.id, type: block.type })
        }

        if (block.type === 'image') {
          const image = block.image
          const imageType: 'file' | 'external' = image.type === 'file' ? 'file' : 'external'
          const source = image.type === 'file' ? image.file?.url : image.external?.url
          const caption = richTextToPlainText(image.caption)
          summary.images.push({
            blockId: block.id,
            type: imageType,
            source,
            caption,
          })
        }

        if (block.has_children) {
          queue.push(block.id)
        }
      })

      cursor = resp.has_more ? resp.next_cursor ?? undefined : undefined
    } while (cursor)
  }

  return summary
}

function isBlockObjectResponse(block: unknown): block is BlockObjectResponse {
  return Boolean(block) && typeof block === 'object' && (block as BlockObjectResponse).object === 'block' && 'type' in (block as BlockObjectResponse)
}

function containsInlineEquation(block: BlockObjectResponse): boolean {
  switch (block.type) {
    case 'paragraph':
      return hasEquationText(block.paragraph.rich_text)
    case 'heading_1':
      return hasEquationText(block.heading_1.rich_text)
    case 'heading_2':
      return hasEquationText(block.heading_2.rich_text)
    case 'heading_3':
      return hasEquationText(block.heading_3.rich_text)
    case 'bulleted_list_item':
      return hasEquationText(block.bulleted_list_item.rich_text)
    case 'numbered_list_item':
      return hasEquationText(block.numbered_list_item.rich_text)
    case 'toggle':
      return hasEquationText(block.toggle.rich_text)
    case 'quote':
      return hasEquationText(block.quote.rich_text)
    case 'callout':
      return hasEquationText(block.callout.rich_text)
    case 'to_do':
      return hasEquationText(block.to_do.rich_text)
    case 'code':
      return hasEquationText(block.code.caption)
    // synced_block and transclusion_container don't have rich_text properties
    default:
      return false
  }
}

function hasEquationText(richTextArray?: RichTextItemResponse[]): boolean {
  if (!Array.isArray(richTextArray)) {
    return false
  }

  return richTextArray.some((item) => item.type === 'equation' && Boolean(item.equation?.expression))
}

function richTextToPlainText(richTextArray?: RichTextItemResponse[]): string | undefined {
  if (!Array.isArray(richTextArray) || richTextArray.length === 0) {
    return undefined
  }
  return richTextArray.map((item) => item.plain_text ?? '').join('').trim() || undefined
}
