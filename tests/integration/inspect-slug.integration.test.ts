/**
 * @jest-environment node
 *
 * This test replicates the functionality of scripts/inspect-slug.ts,
 * verifying post retrieval and record map fetching.
 */

import 'dotenv/config'
import { getPosts } from 'src/apis/notion-client/getPosts'
import { getPostBySlug } from 'src/apis/notion-client/getPostBySlug'
import { getRecordMap } from 'src/apis/notion-client/getRecordMap'

const REQUIRED_ENV = ['NOTION_TOKEN', 'NOTION_DATASOURCE_ID'] as const
const missingEnv = REQUIRED_ENV.filter((key) => !process.env[key])

jest.setTimeout(60000)

const describeMaybe = missingEnv.length ? describe.skip : describe

if (missingEnv.length) {
  console.warn(
    `ℹ️  Skipping Notion inspect-slug tests because env vars are missing: ${missingEnv.join(', ')}`
  )
}

describeMaybe('Notion integration - inspect slug', () => {
  let testSlug: string | undefined

  beforeAll(async () => {
    // Find a valid slug from recent posts to use for testing
    const posts = await getPosts()
    const validPost = posts.find((p) => p.slug && p.id)
    if (validPost) {
      testSlug = validPost.slug
      console.log('Using test slug:', testSlug)
    } else {
      console.warn('⚠️ No posts found to test slug inspection')
    }
  })

  it('1) getPosts (cached) -> find slug', async () => {
    if (!testSlug) return

    const postsCached = await getPosts()
    const foundCached = postsCached.find((p) => p.slug === testSlug)
    
    expect(foundCached).toBeDefined()
    if (foundCached) {
      expect(foundCached.id).toBeTruthy()
      expect(foundCached.title).toBeTruthy()
    }
  })

  it('2) getPosts({ bypassCache: true }) -> fresh', async () => {
    if (!testSlug) return

    const postsFresh = await getPosts({ bypassCache: true } as any)
    const foundFresh = postsFresh.find((p) => p.slug === testSlug)
    
    expect(foundFresh).toBeDefined()
    if (foundFresh) {
      expect(foundFresh.id).toBeTruthy()
      expect(foundFresh.title).toBeTruthy()
    }
  })

  it('3) getPostBySlug (uses bypass)', async () => {
    if (!testSlug) return

    const bySlug = await getPostBySlug(testSlug)
    
    expect(bySlug).toBeDefined()
    if (bySlug) {
      expect(bySlug.id).toBeTruthy()
      expect(bySlug.title).toBeTruthy()
    }
  })

  it('4) getRecordMap for id', async () => {
    if (!testSlug) return

    const bySlug = await getPostBySlug(testSlug)
    if (bySlug && bySlug.id) {
      const recordMap = await getRecordMap(bySlug.id)
      
      expect(recordMap).toBeDefined()
      if (recordMap) {
        const blockCount = Object.keys(recordMap.block || {}).length
        expect(blockCount).toBeGreaterThan(0)
        
        // Check first few blocks
        const blocks = Object.values(recordMap.block).slice(0, 6) as any
        blocks.forEach((b: any) => {
          expect(b.value?.id).toBeTruthy()
          expect(b.value?.type).toBeTruthy()
        })
      }
    }
  })
})
