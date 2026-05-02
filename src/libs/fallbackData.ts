// Fallback static data when Notion API is unavailable
export const FALLBACK_POSTS = [
  {
    id: "fallback-1",
    name: "Notion API 일시적 오류",
    slug: "notion-api-temporary-error",
    tags: ["Notice"],
    category: "System",
    summary: "Notion API에 일시적으로 접근할 수 없습니다. 잠시 후 다시 시도해주세요.",
    author: [{ name: "System" }],
    type: ["Post"],
    status: ["Public"],
    date: { start_date: new Date().toISOString() },
    createdTime: new Date().toISOString(),
    fullWidth: false,
  }
]
