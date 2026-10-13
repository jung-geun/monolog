/** @jest-environment node */
import type { TPost } from "src/types"
import { highlightRanges, matchPost, parseSearchQuery, searchPosts } from "src/routes/Search/query"

const posts: TPost[] = [
  {
    id: "storage", slug: "storage", title: "Rust storage recovery", summary: "Repairing distributed volumes",
    tags: ["Rust", "Machine Learning"], category: ["Systems", "Research Notes"],
    date: { start_date: "2026-10-01" }, createdTime: "2026-10-01", type: ["Post"], status: ["Public"], fullWidth: false,
  },
  {
    id: "web", slug: "web", title: "Accessible navigation", summary: "Keyboard focus in a browser",
    tags: ["TypeScript"], category: ["Frontend"],
    date: { start_date: "2026-10-02" }, createdTime: "2026-10-02", type: ["Post"], status: ["Public"], fullWidth: false,
  },
]

describe("publication metadata search", () => {
  it("matches titles, summaries, tags and every category without calling summary body", () => {
    for (const query of ["RUST", "volumes", "machine", "research"]) {
      expect(searchPosts(posts, query).map(post => post.id)).toEqual(["storage"])
    }
    expect(searchPosts(posts, "browser", "summary").map(post => post.id)).toEqual(["web"])
    expect(searchPosts(posts, "browser", "title")).toEqual([])
  })

  it("parses quoted tag and category filters and requires every term", () => {
    expect(parseSearchQuery('tag:"Machine Learning" CATEGORY:\'Research Notes\' recovery')).toEqual([
      { field: "tags", value: "machine learning" }, { field: "category", value: "research notes" }, { field: "all", value: "recovery" },
    ])
    expect(searchPosts(posts, 'tag:rust category:"Research Notes" recovery').map(post => post.id)).toEqual(["storage"])
    expect(searchPosts(posts, "tag:rust category:frontend")).toEqual([])
    expect(searchPosts(posts, "Rust navigation")).toEqual([])
  })

  it("keeps filters constrained to their fields and treats unsupported prefixes literally", () => {
    expect(searchPosts(posts, "tag:browser")).toEqual([])
    expect(searchPosts(posts, "category:rust")).toEqual([])
    expect(parseSearchQuery("body:browser")).toEqual([{ field: "all", value: "body:browser" }])
    expect(searchPosts(posts, "body:browser")).toEqual([])
    expect(searchPosts(posts, "tag: category: ")).toEqual(posts)
    expect(matchPost({ ...posts[0], tags: undefined, category: undefined, summary: undefined }, parseSearchQuery("tag:rust"))).toBe(false)
  })

  it("returns all publications for an empty query", () => {
    expect(searchPosts(posts, "")).toEqual(posts)
    expect(searchPosts(posts, "  ")).toEqual(posts)
  })

  it("highlights repeated and overlapping matches only in their matching fields", () => {
    expect(highlightRanges("Rust rust", parseSearchQuery("rust ust"), "title")).toEqual([[0, 4], [5, 9]])
    expect(highlightRanges("Rust", parseSearchQuery("tag:rust"), "title")).toEqual([])
    expect(highlightRanges("Rust", parseSearchQuery("tag:rust"), "tags")).toEqual([[0, 4]])
    expect(highlightRanges("Research Notes", parseSearchQuery('category:"Research Notes"'), "category")).toEqual([[0, 14]])
  })
})
