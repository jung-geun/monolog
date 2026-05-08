import { z } from "zod"

const MAX_BODY = 1000
const MAX_URLS = 2
const URL_RE = /https?:\/\/\S+/gi
const ZERO_WIDTH_RE = /[​-‏⁠﻿]/g

function stripTags(s: string): string {
  return s.replace(/<[^>]*>/g, "").replace(/\0/g, "").trim()
}

function countUrls(s: string): number {
  return (s.match(URL_RE) ?? []).length
}

export const commentPostSchema = z.object({
  slug: z.string().min(1).max(200),
  postId: z.string().min(1).max(100),
  body: z
    .string()
    .min(2, "2자 이상 입력해주세요")
    .max(MAX_BODY, `${MAX_BODY}자 이내로 입력해주세요`),
  hp: z.string().max(0, "spam").optional(),
})

export type CommentPostInput = z.infer<typeof commentPostSchema>

export function sanitizeBody(raw: string): string {
  return stripTags(raw)
    .replace(ZERO_WIDTH_RE, "")
    .replace(/\r\n?/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .slice(0, MAX_BODY)
}

export function checkSpam(input: CommentPostInput): string | null {
  if (input.hp) return "spam"
  if (countUrls(input.body) > MAX_URLS) return "too many urls"
  return null
}
