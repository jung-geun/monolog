import type { NextApiRequest, NextApiResponse } from 'next'
import { getPosts } from 'src/apis/notion-client/getPosts'
import { getPostBySlug } from 'src/apis/notion-client/getPostBySlug'
import { getRecordMap } from 'src/apis/notion-client/getRecordMap'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const slug = String(req.query.slug || '')
  if (!slug) return res.status(400).json({ error: 'slug query required' })

  try {
    const cachedPosts = await getPosts()
    const cached = cachedPosts.find(p => p.slug === slug) || null

    const freshPosts = await getPosts({ bypassCache: true } as any)
    const fresh = freshPosts.find(p => p.slug === slug) || null

    const bySlug = await getPostBySlug(slug)

    let recordMap = null
    if (bySlug && bySlug.id) {
      recordMap = await getRecordMap(bySlug.id)
    }

    return res.status(200).json({
      slug,
      cached: cached ? { id: cached.id, title: cached.title, updated: cached.date?.start_date || cached.createdTime } : null,
      fresh: fresh ? { id: fresh.id, title: fresh.title, updated: fresh.date?.start_date || fresh.createdTime } : null,
      bySlug: bySlug ? { id: bySlug.id, title: bySlug.title } : null,
      recordMapSummary: recordMap ? { blocks: Object.keys(recordMap.block || {}).length } : null,
    })
  } catch (e) {
    return res.status(500).json({ error: String(e) })
  }
}
