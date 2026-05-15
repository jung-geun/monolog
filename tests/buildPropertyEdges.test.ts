/**
 * @jest-environment node
 */
import { buildPropertyEdges, normalizeHubId } from "src/apis/notion-client/buildNotionGraph"
import type { TPost } from "src/types"

const makePost = (overrides: Partial<TPost> & { id: string }): TPost =>
  ({
    title: "Test Post",
    slug: overrides.id,
    type: "Post",
    createdTime: "2024-01-01",
    fullWidth: false,
    tags: [],
    ...overrides,
  } as TPost)

describe("buildPropertyEdges", () => {
  it("tag 1개 → tag 노드 1개, has-tag 엣지 1개", () => {
    const posts = [makePost({ id: "p1", tags: ["react"] })]
    const { hubNodes, propertyEdges } = buildPropertyEdges(posts)
    const tagNodes = hubNodes.filter((n) => n.kind === "tag")
    expect(tagNodes).toHaveLength(1)
    expect(tagNodes[0].id).toBe("tag:react")
    const tagEdges = propertyEdges.filter((e) => e.type === "has-tag")
    expect(tagEdges).toHaveLength(1)
    expect(tagEdges[0]).toMatchObject({ source: "p1", target: "tag:react" })
  })

  it("tag N개 post → hub 1개, has-tag 엣지 N개 (N² 아님)", () => {
    const posts = [
      makePost({ id: "p1", tags: ["openstack"] }),
      makePost({ id: "p2", tags: ["openstack"] }),
      makePost({ id: "p3", tags: ["openstack"] }),
      makePost({ id: "p4", tags: ["openstack"] }),
    ]
    const { hubNodes, propertyEdges } = buildPropertyEdges(posts)
    const tagNodes = hubNodes.filter((n) => n.kind === "tag")
    expect(tagNodes).toHaveLength(1)
    const tagEdges = propertyEdges.filter((e) => e.type === "has-tag")
    expect(tagEdges).toHaveLength(4)
  })

  it("시리즈 3개 글 → series 노드 1개, in-series 엣지 3개 (series-next 직접 연결 없음)", () => {
    const posts = [
      makePost({ id: "p1", series: ["k8s-guide"], date: { start_date: "2024-01-01" } }),
      makePost({ id: "p2", series: ["k8s-guide"], date: { start_date: "2024-01-03" } }),
      makePost({ id: "p3", series: ["k8s-guide"], date: { start_date: "2024-01-02" } }),
    ]
    const { hubNodes, propertyEdges } = buildPropertyEdges(posts)
    const seriesNodes = hubNodes.filter((n) => n.kind === "series")
    expect(seriesNodes).toHaveLength(1)
    expect(seriesNodes[0].id).toBe("series:k8s-guide")

    const inSeriesEdges = propertyEdges.filter((e) => e.type === "in-series")
    expect(inSeriesEdges).toHaveLength(3)

    // series hub가 이미 같은 시리즈를 묶으므로 post 간 직접 연결 없음
    const postToPostEdges = propertyEdges.filter((e) => {
      const allPostIds = posts.map((p) => p.id)
      return allPostIds.includes(e.source) && allPostIds.includes(e.target)
    })
    expect(postToPostEdges).toHaveLength(0)
  })

  it("ID 정규화: 'GPU'와 'gpu' 태그는 같은 노드로 머지", () => {
    const posts = [
      makePost({ id: "p1", tags: ["GPU"] }),
      makePost({ id: "p2", tags: ["gpu"] }),
    ]
    const { hubNodes } = buildPropertyEdges(posts)
    const tagNodes = hubNodes.filter((n) => n.kind === "tag")
    expect(tagNodes).toHaveLength(1)
    expect(tagNodes[0].id).toBe("tag:gpu")
  })
})

describe("normalizeHubId", () => {
  it("prefix와 소문자 이름을 합성한다", () => {
    expect(normalizeHubId("tag", "  React  ")).toBe("tag:react")
    expect(normalizeHubId("series", "Kube Guide")).toBe("series:kube guide")
  })
})
