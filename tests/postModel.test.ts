/** @jest-environment node */
import { normalizeNotionPost, isPublicPost, isFeedPost, selectPublicPosts } from "src/apis/notion-client/postModel"

function page(properties: Record<string, unknown> = {}) {
  return {
    id: "post-1",
    created_time: "2025-01-01T00:00:00.000Z",
    last_edited_time: "2025-02-01T00:00:00.000Z",
    properties: {
      Title: { type: "title", title: [{ plain_text: "  Horizon " }, { plain_text: "설치  " }] },
      Slug: { type: "rich_text", rich_text: [{ plain_text: " horizon-" }, { plain_text: "install " }] },
      Summary: { type: "rich_text", rich_text: [{ plain_text: "Horizon을 설치하고 " }, { plain_text: "local_settings.py", annotations: { code: true } }, { plain_text: "를 설정합니다." }] },
      Status: { type: "status", status: { name: "Public" } },
      Type: { type: "select", select: { name: "Post" } },
      ...properties,
    },
  }
}

describe("Notion publication normalization", () => {
  it("keeps the complete title, slug and summary across formatting segments", () => {
    const post = normalizeNotionPost(page())
    expect(post.title).toBe("Horizon 설치")
    expect(post.slug).toBe("horizon-install")
    expect(post.summary).toBe("Horizon을 설치하고 local_settings.py를 설정합니다.")
  })

  it("keeps thumbnails accepted by Next.js when the public site URL is configured", () => {
    const previous = process.env.NEXT_PUBLIC_SITE_URL
    process.env.NEXT_PUBLIC_SITE_URL = "https://blog.pieroot.xyz"
    try {
      let normalize!: typeof normalizeNotionPost
      jest.isolateModules(() => { normalize = require("src/apis/notion-client/postModel").normalizeNotionPost })
      const post = normalize(page({ Thumbnail: { type: "url", url: "https://www.notion.so/image/example" } }))
      const { ImageOptimizerCache } = require("next/dist/server/image-optimizer")
      const { imageConfigDefault } = require("next/dist/shared/lib/image-config")
      const config = require("../next.config")
      const params = ImageOptimizerCache.validateParams({ headers: {} }, {
        url: post.thumbnail, w: "640", q: "75",
      }, { ...config, images: { ...imageConfigDefault, ...config.images } }, false)
      expect(params).toMatchObject({ isAbsolute: false, width: 640 })
    } finally {
      if (previous === undefined) delete process.env.NEXT_PUBLIC_SITE_URL
      else process.env.NEXT_PUBLIC_SITE_URL = previous
    }
  })

  it.each(["Private", "Published", "", "toString"])("does not publish status %s", (status) => {
    const post = normalizeNotionPost(page({ Status: { type: "select", select: { name: status } } }))
    expect(isPublicPost(post)).toBe(false)
  })

  it("never publishes archived content or incomplete upstream metadata", () => {
    expect(isPublicPost(normalizeNotionPost({ ...page(), in_trash: true }))).toBe(false)
    expect(() => normalizeNotionPost({ id: "post-1" })).toThrow()
  })

  it("excludes scheduled and reserved-path posts from every public snapshot", () => {
    const scheduled = normalizeNotionPost(page({ Date: { type: "date", date: { start: "2099-01-01" } } }))
    const collision = normalizeNotionPost(page({ Slug: { type: "rich_text", rich_text: [{ plain_text: "api" }] } }))
    expect(selectPublicPosts([scheduled, collision])).toEqual([])
  })

  it("allows public detail-only pages without making them ordinary feed posts", () => {
    const post = normalizeNotionPost(page({ Status: { type: "select", select: { name: "PublicOnDetail" } } }))
    expect(selectPublicPosts([post]).map((value) => value.slug)).toEqual(["horizon-install"])
    expect(isFeedPost(post)).toBe(false)
  })
})
