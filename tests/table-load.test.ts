/**
 * @jest-environment node
 *
 * This test checks if we can successfully load and parse table blocks from Notion.
 */

import 'dotenv/config'
import type { PageObjectResponse, BlockObjectResponse } from '@notionhq/client/build/src/api-endpoints'
import { getOfficialNotionClient } from 'src/apis/notion-client/notionClient'
import { summarizeBlockTypes } from 'src/libs/utils/notion/analyzeBlocks'
import { getRecordMap } from 'src/apis/notion-client/getRecordMap'

const REQUIRED_ENV = ['NOTION_TOKEN', 'NOTION_DATASOURCE_ID'] as const
const missingEnv = REQUIRED_ENV.filter((key) => !process.env[key])

jest.setTimeout(120000) // Increased timeout for traversing pages

const describeMaybe = missingEnv.length ? describe.skip : describe

if (missingEnv.length) {
  console.warn(
    `ℹ️  Skipping Notion table load tests because env vars are missing: ${missingEnv.join(', ')}`
  )
}

describeMaybe('Notion integration - Table load test', () => {
  let notion: ReturnType<typeof getOfficialNotionClient>
  let dataSourceId: string
  let tablePageId: string | undefined

  beforeAll(async () => {
    notion = getOfficialNotionClient()
    dataSourceId = process.env.NOTION_DATASOURCE_ID ?? ''
    if (!dataSourceId) {
      throw new Error('NOTION_DATASOURCE_ID env var is required for this test')
    }
  })

  it('should find a page containing a table block', async () => {
    // 1. Fetch recent pages
    const response = await notion.dataSources.query({
      data_source_id: dataSourceId,
      page_size: 50, // Check up to 50 recent pages
    })
    
    const pages = response.results.filter((item): item is PageObjectResponse => 
      'properties' in item
    )

    console.log(`Scanning ${pages.length} pages for a table...`)

    // 2. Scan pages for a table block
    for (const page of pages) {
      const summary = await summarizeBlockTypes(notion, page.id)
      if (summary.types['table'] && summary.types['table'] > 0) {
        console.log(`Found table in page: ${page.id}`)
        tablePageId = page.id
        break
      }
    }

    if (!tablePageId) {
      console.warn('⚠️ No table block found in the recent 50 pages. Please add a page with a table to run this test fully.')
    }

    // If we found a page with a table, the test passes this step. 
    // If not, we can't proceed with detailed table verification, but we don't necessarily fail if the goal is just to "check" capability.
    // However, to strictly "confirm we can load tables", we really need one.
    // For now, let's assert we found one, so the user knows if their environment is ready.
    expect(tablePageId).toBeDefined()
  })

  it('should retrieve recordMap with table data correctly', async () => {
    if (!tablePageId) {
      console.warn('Skipping recordMap check because no table page was found.')
      return
    }

    const recordMap = await getRecordMap(tablePageId)
    expect(recordMap).toBeDefined()
    
    if (!recordMap) return

    // Check if the recordMap contains a table block
    const blocks = Object.values(recordMap.block).map(b => b.value)
    const tableBlock = blocks.find(b => b.type === 'table')
    
    expect(tableBlock).toBeDefined()
    console.log('Table block found in recordMap:', tableBlock?.id)

    if (tableBlock) {
      // Check if table has children (rows)
      expect(tableBlock.content).toBeDefined()
      expect(Array.isArray(tableBlock.content)).toBe(true)
      expect(tableBlock.content!.length).toBeGreaterThan(0)

      // Check the first row
      const firstRowId = tableBlock.content![0]
      const firstRow = recordMap.block[firstRowId]?.value
      
      expect(firstRow).toBeDefined()
      expect(firstRow.type).toBe('table_row')
      
      // Check properties (cells)
      // In getRecordMap.ts: properties[`cell_${index}`] = convertRichText(cell)
      expect(firstRow.properties).toBeDefined()
      
      // Check if there is at least one cell property
      const cellKeys = Object.keys(firstRow.properties).filter(k => k.startsWith('cell_'))
      expect(cellKeys.length).toBeGreaterThan(0)
      
      console.log('Table row verified with cells:', cellKeys)
      
      // Log table block and first row for inspection
      console.log('Table Block:', JSON.stringify(tableBlock, null, 2))
      console.log('First Row Block:', JSON.stringify(firstRow, null, 2))
    }
  })
})
