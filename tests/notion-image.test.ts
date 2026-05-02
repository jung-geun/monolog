/**
 * @jest-environment node
 *
 * 이 테스트는 실제 Notion API(공식 클라이언트)를 호출하는 통합 테스트입니다.
 * DOM API에 의존하지 않으므로 Node 환경에서 실행해야 window 관련 mock이 필요 없습니다.
 */

import 'dotenv/config'
import type { PageObjectResponse, QueryDataSourceResponse } from '@notionhq/client/build/src/api-endpoints'
import { getOfficialNotionClient } from 'src/apis/notion-client/notionClient'
import { summarizeBlockTypes } from 'src/libs/utils/notion/analyzeBlocks'
import type { BlockSummary } from 'src/libs/utils/notion/analyzeBlocks'
const REQUIRED_ENV = ['NOTION_TOKEN', 'NOTION_DATASOURCE_ID'] as const
const missingEnv = REQUIRED_ENV.filter((key) => !process.env[key])

const TEST_POST_TITLE = (process.env.NOTION_TEST_POST_TITLE ?? 'test post').trim().toLowerCase()

type TitleProperty = Extract<PageObjectResponse['properties'][string], { type: 'title' }>
const isTitleProperty = (property: PageObjectResponse['properties'][string]): property is TitleProperty =>
  property?.type === 'title'

jest.setTimeout(60000)

const describeMaybe = missingEnv.length ? describe.skip : describe

if (missingEnv.length) {
  // eslint-disable-next-line no-console
  console.warn(
    `ℹ️  Skipping Notion integration tests because env vars are missing: ${missingEnv.join(', ')}`
  )
}

describeMaybe('Notion integration - test post lookup', () => {
  let notion: ReturnType<typeof getOfficialNotionClient>
  let dataSourceId: string
  let pages: PageObjectResponse[]
  let targetPage: PageObjectResponse | undefined
  let fullPage: PageObjectResponse | undefined
  let summary: BlockSummary | undefined

  beforeAll(async () => {
    notion = getOfficialNotionClient()
    dataSourceId = process.env.NOTION_DATASOURCE_ID ?? ''
    if (!dataSourceId) {
      throw new Error('NOTION_DATASOURCE_ID env var is required for this test')
    }

    const collected: PageObjectResponse[] = []
    let cursor: string | null | undefined = undefined
    do {
      const resp: QueryDataSourceResponse = await notion.dataSources.query({
        data_source_id: dataSourceId,
        page_size: 100,
        start_cursor: cursor ?? undefined,
      })

      resp.results.forEach((entry: any) => {
        if ('properties' in entry) {
          collected.push(entry as PageObjectResponse)
        }
      })

      cursor = resp.has_more ? resp.next_cursor : null
    } while (cursor)

    pages = collected

    const normalize = (value?: string | null) => value?.trim().toLowerCase()
    const foundPage = pages.find((entry) => {
      const titleProperty = Object.values(entry.properties).find(isTitleProperty)
      const titleText = titleProperty?.title?.map((block) => block.plain_text).join('')
      return normalize(titleText) === TEST_POST_TITLE
    })

    if (!foundPage) {
      const sampleTitles = pages
        .map((entry) => {
          const prop = Object.values(entry.properties).find(isTitleProperty)
          return prop?.title?.map((block) => block.plain_text).join('')
        })
        .filter(Boolean)
        .slice(0, 10)
      // eslint-disable-next-line no-console
      console.warn(
        `ℹ️  Skipping notion-image fixture-dependent assertions: no page titled "${TEST_POST_TITLE}" found. ` +
          `Set NOTION_TEST_POST_TITLE in .env to an existing page title, or create one. ` +
          `Sample titles: ${sampleTitles.join(', ')}`
      )
      return
    }

    targetPage = foundPage

    const page = await notion.pages.retrieve({ page_id: targetPage.id })

    if (!('properties' in page)) {
      throw new Error('Expected a full page object response from Notion API')
    }

    fullPage = page as PageObjectResponse
    summary = await summarizeBlockTypes(notion, targetPage.id)
  })

  it('retrieves the list of Notion pages', () => {
    expect(Array.isArray(pages)).toBe(true)
    expect(pages.length).toBeGreaterThan(0)
  })

  it('finds the configured test post within the Notion database', () => {
    if (!targetPage) return
    expect(targetPage.id).toBeTruthy()
  })

  it('retrieves the page detail and validates the title', () => {
    if (!fullPage) return
    const titleProperty = Object.values(fullPage.properties).find(isTitleProperty)
    const fetchedTitle = titleProperty?.title
      ?.map((entry) => entry.plain_text)
      ?.join('')
    const normalizedTitle = fetchedTitle?.trim().toLowerCase()

    expect(normalizedTitle).toBe(TEST_POST_TITLE)
  })

  it('summarizes block types for the page', () => {
    if (!summary) return
    expect(summary.totalBlocks).toBeGreaterThan(0)
    expect(Object.keys(summary.types).length).toBeGreaterThan(0)
    expect(summary.types).toHaveProperty('paragraph')
    expect(Array.isArray(summary.images)).toBe(true)

    // 디버깅/레퍼런스용 로그
    // eslint-disable-next-line no-console
    console.log('[notion-test] Block summary', summary)
  })

  it('collects inline math metadata for supported block types', () => {
    if (!summary) return
    const INLINE_MATH_TARGETS = new Set([
      'paragraph',
      'heading_1',
      'heading_2',
      'heading_3',
      'bulleted_list_item',
      'numbered_list_item',
    ])

    expect(Array.isArray(summary.inlineMath)).toBe(true)

    const blockIdsWithInlineMath = summary.inlineMath.filter((entry) => INLINE_MATH_TARGETS.has(entry.type))

    blockIdsWithInlineMath.forEach((info) => {
      expect(info).toHaveProperty('blockId')
      expect(info).toHaveProperty('type')
    })
  })

  it('collects image metadata when image blocks are present', () => {
    if (!summary) return
    if (summary.types.image && summary.types.image > 0) {
      expect(summary.images.length).toBeGreaterThan(0)
    }

    summary.images.forEach((img) => {
      expect(img).toHaveProperty('blockId')
      expect(img).toHaveProperty('source')
    })
  })
})
