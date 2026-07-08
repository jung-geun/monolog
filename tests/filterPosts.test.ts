/**
 * @jest-environment node
 */

import { filterPosts } from "src/libs/utils/notion/filterPosts"

const makePost = (overrides: any = {}) => ({
  title: "Test Post",
  slug: "test-post",
  type: ["Post"],
  status: ["Public"],
  createdTime: "2024-01-01",
  ...overrides,
})

describe("filterPosts", () => {
  const originalNodeEnv = process.env.NODE_ENV
  const setNodeEnv = (value: string | undefined) => {
    ;(process.env as any).NODE_ENV = value
  }

  beforeEach(() => {
    setNodeEnv("production")
  })

  afterAll(() => {
    setNodeEnv(originalNodeEnv)
  })

  it("uses createdTime when date is missing", () => {
    const posts = [
      makePost({ id: "p1", createdTime: "2025-01-01" }),
      makePost({ id: "p2", date: { start_date: "2024-01-01" }, createdTime: "2025-01-01" }),
    ]

    const out = filterPosts(posts, { acceptStatus: ["Public"], acceptType: ["Post"] })
    expect(out).toHaveLength(2)
    expect(out.map((p) => p.id)).toEqual(["p1", "p2"])
  })

  it("excludes posts without title/slug and without parseable date", () => {
    const posts = [
      makePost({ id: "p1", title: "", slug: "no-title" }),
      makePost({ id: "p2", title: "No slug", slug: "" }),
      makePost({ id: "p3", title: "Bad date", createdTime: "not-a-date" }),
    ]

    const out = filterPosts(posts, { acceptStatus: ["Public"], acceptType: ["Post"] })
    expect(out).toHaveLength(0)
  })

  it("filters out future posts in production", () => {
    const future = new Date()
    future.setDate(future.getDate() + 1)

    const posts = [
      makePost({ id: "past", createdTime: "2024-01-01" }),
      makePost({ id: "future", createdTime: future.toISOString().slice(0, 10) }),
    ]

    const out = filterPosts(posts, { acceptStatus: ["Public"], acceptType: ["Post"] })
    expect(out.map((p) => p.id)).toEqual(["past"])
  })

  it("lets future posts through in development", () => {
    setNodeEnv("development")
    const future = new Date()
    future.setDate(future.getDate() + 2)

    const posts = [
      makePost({ id: "future", createdTime: future.toISOString().slice(0, 10) }),
    ]

    const out = filterPosts(posts, { acceptStatus: ["Public"], acceptType: ["Post"] })
    expect(out.map((p) => p.id)).toEqual(["future"])
  })
})
