/**
 * @jest-environment node
 */

import 'dotenv/config'
import { Client } from '@notionhq/client'
import { getOfficialNotionClient } from 'src/apis/notion-client/notionClient'
import type {
  ParagraphBlockObjectResponse,
  NumberedListItemBlockObjectResponse,
  BulletedListItemBlockObjectResponse,
} from '@notionhq/client/build/src/api-endpoints'

// Notion Client initialization
// const notion = getOfficialNotionClient()

// Test page ID - using the test-post page
// Note: In a real scenario, it might be better to find this page dynamically like in notion-image.test.ts
// preserving the ID from the original script for now.
const TEST_PAGE_ID = '2a9067c0-15d0-801a-bd1f-c1f54d973b81'

const describeMaybe = process.env.NOTION_TOKEN ? describe : describe.skip

if (!process.env.NOTION_TOKEN) {
  // eslint-disable-next-line no-console
  console.warn('ℹ️  Skipping Color Support tests because NOTION_TOKEN is missing')
}

describeMaybe('Notion API Color Support', () => {
  let notion: Client

  beforeAll(() => {
    notion = getOfficialNotionClient()
  })

  jest.setTimeout(60000)

  it('should retrieve paragraph, numbered_list_item, and bulleted_list_item blocks with color information', async () => {
    // Fetch the page content
    const response = await notion.blocks.children.list({
      block_id: TEST_PAGE_ID,
      page_size: 100,
    })

    expect(response.results.length).toBeGreaterThan(0)

    // Define types to check
    type SupportedBlock =
      | ParagraphBlockObjectResponse
      | NumberedListItemBlockObjectResponse
      | BulletedListItemBlockObjectResponse

    const targetTypes = ['paragraph', 'numbered_list_item', 'bulleted_list_item']

    // Look for target blocks
    const targetBlocks = response.results.filter(
      (block): block is SupportedBlock =>
        'type' in block && targetTypes.includes(block.type)
    )

    // eslint-disable-next-line no-console
    console.log(`📝 Found ${targetBlocks.length} target blocks`)
    expect(targetBlocks.length).toBeGreaterThan(0)

    targetBlocks.forEach((block, index) => {
      // eslint-disable-next-line no-console
      console.log(`\n--- Block ${index + 1} (${block.type}) ---`)

      let contentObj: any

      if (block.type === 'paragraph') {
        contentObj = block.paragraph
      } else if (block.type === 'numbered_list_item') {
        contentObj = block.numbered_list_item
      } else if (block.type === 'bulleted_list_item') {
        contentObj = block.bulleted_list_item
      }

      expect(contentObj).toBeDefined()

      if (contentObj) {
        // Check for color properties
        if (contentObj.color) {
          // eslint-disable-next-line no-console
          console.log('🎨 Color property found:', contentObj.color)
          expect(typeof contentObj.color).toBe('string')
        }

        // Check rich_text annotations for color
        if (contentObj.rich_text && contentObj.rich_text.length > 0) {
          contentObj.rich_text.forEach((text: any, textIndex: number) => {
            if (text.annotations) {
              if (text.annotations.color) {
                // eslint-disable-next-line no-console
                console.log(`🎨 Text ${textIndex} has color:`, text.annotations.color)
                expect(typeof text.annotations.color).toBe('string')
              }
            }
          })
        }
      }
    })

    // Check if any block has color property at top level (based on original script logic)
    const blocksWithColor = response.results.filter((block) => {
      const blockKeys = Object.keys(block)
      return blockKeys.some((key) => key.includes('color'))
    })

    // eslint-disable-next-line no-console
    console.log(`\n🔍 Found ${blocksWithColor.length} blocks with color properties at top level`)
    
    if (blocksWithColor.length > 0) {
      blocksWithColor.forEach((block) => {
        // @ts-ignore
        const colorKeys = Object.keys(block).filter((key) => key.includes('color'))
        if ('type' in block) {
          // eslint-disable-next-line no-console
          console.log(`Block ${block.id} (${block.type}) has color keys:`, colorKeys)
        }
      })
    }
  })
})
