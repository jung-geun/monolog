import { z } from "zod"
import type { TPost } from "src/types"
import { createProxyRequestUrl } from "src/libs/utils/image/proxyUtils"
export { isPublicPost, isFeedPost, isSafePostSlug, sortPosts, selectPublicPosts } from "src/libs/utils/notion/publication"

const richTextSchema = z.object({
  plain_text: z.string().optional(),
  text: z.object({ content: z.string() }).optional(),
})
const selectionSchema = z.object({ name: z.string() }).nullish()
const propertySchema = z.object({
  type: z.string(),
  title: z.array(richTextSchema).optional(),
  rich_text: z.array(richTextSchema).optional(),
  select: selectionSchema,
  status: selectionSchema,
  multi_select: z.array(z.object({ name: z.string() })).optional(),
  date: z.object({ start: z.string() }).nullish(),
  url: z.string().nullish(),
  files: z.array(z.object({
    file: z.object({ url: z.string() }).optional(),
    external: z.object({ url: z.string() }).optional(),
  })).optional(),
  people: z.array(z.object({
    id: z.string(), name: z.string().nullish(), avatar_url: z.string().nullish(),
  })).optional(),
})
const pageSchema = z.object({
  id: z.string().min(1),
  properties: z.record(z.string(), propertySchema),
  created_time: z.string(),
  last_edited_time: z.string().optional(),
  in_trash: z.boolean().optional(),
  archived: z.boolean().optional(),
})

function richTextToPlainText(segments: { plain_text?: string; text?: { content: string } }[] | undefined): string {
  return (segments ?? []).map((segment) => segment.plain_text ?? segment.text?.content ?? "").join("").trim()
}

export function normalizeNotionPost(value: unknown): TPost {
  const page = pageSchema.parse(value)
  const post: TPost = {
    id: page.id,
    title: "",
    slug: "",
    summary: "",
    status: [],
    type: [],
    date: { start_date: page.created_time },
    createdTime: page.created_time,
    ...(page.last_edited_time ? { lastEditedTime: page.last_edited_time } : {}),
    fullWidth: false,
  }

  for (const [property, prop] of Object.entries(page.properties)) {
    const key = property.toLowerCase()
    if (prop.type === "title") {
      post.title = richTextToPlainText(prop.title)
    } else if (prop.type === "rich_text") {
      const text = richTextToPlainText(prop.rich_text)
      if (key === "slug") post.slug = text
      else if (key === "summary") post.summary = text
      else if (key === "thumbnail" && text) post.thumbnail = createProxyRequestUrl(text, { pageId: page.id, property, propertyType: "rich_text", source: "postThumbnail" })
    } else if (prop.type === "select" || prop.type === "status") {
      const name = (prop.type === "select" ? prop.select : prop.status)?.name.trim()
      if (!name) continue
      if (key === "status" && (name === "Public" || name === "PublicOnDetail" || name === "Private")) post.status = [name]
      else if (key === "type") {
        const type = name.charAt(0).toUpperCase() + name.slice(1).toLowerCase()
        if (type === "Post" || type === "Paper" || type === "Page") post.type = [type]
      } else if (key === "category") post.category = [name]
      else if (key === "series") post.series = [name]
    } else if (prop.type === "multi_select") {
      const names = (prop.multi_select ?? []).map((item) => item.name.trim()).filter(Boolean)
      if (key === "tags") post.tags = names
      else if (key === "category") post.category = names
      else if (key === "series") post.series = names
    } else if (prop.type === "date" && key === "date" && prop.date?.start) {
      post.date = { start_date: prop.date.start }
    } else if (prop.type === "url" && prop.url) {
      if (key === "slug") post.slug = prop.url.trim()
      else if (key === "thumbnail") post.thumbnail = createProxyRequestUrl(prop.url, { pageId: page.id, property, propertyType: "url", source: "postThumbnail" })
    } else if (prop.type === "files" && key === "thumbnail") {
      const file = prop.files?.[0]
      const url = file?.file?.url ?? file?.external?.url
      if (url) post.thumbnail = createProxyRequestUrl(url, { pageId: page.id, property, propertyType: "files", source: "postThumbnail" })
    } else if (prop.type === "people" && key === "author") {
      post.author = (prop.people ?? []).map((person) => ({
        id: person.id,
        name: person.name ?? "",
        ...(person.avatar_url ? { profile_photo: person.avatar_url } : {}),
      }))
    }
  }

  // Archived pages and unsupported/unknown statuses must never become public.
  if (page.in_trash || page.archived) post.status = []
  return post
}

