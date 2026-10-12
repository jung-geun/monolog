import { renderToStaticMarkup } from "react-dom/server"
import type { Decoration, ExtendedRecordMap, TextBlock } from "notion-types"
import type { TPost } from "src/types"
import { buildIdToSlug, normalizeNotionId } from "src/libs/utils/notion/rewriteInternalLinks"
import { unwrapBlock } from "src/libs/utils/notion/unwrapBlock"
import { normalizeStandalonePageLinks } from "src/routes/Detail/components/NotionRenderer/standalonePageLinks"
import { createPreviewPageLink } from "src/routes/Detail/components/NotionRenderer/PageLink"

const rootId = "11111111-1111-4111-8111-111111111111"
// Actual cached /kolla-ansible-trove standalone link and its Octavia target.
const sourceId = "359067c0-15d0-8025-acdc-d23de1deb662"
const targetId = "30c067c0-15d0-8095-8339-f77a1517ace2"
const href = `https://app.notion.com/p/${normalizeNotionId(targetId)}`
const post: TPost = {
  id: targetId,
  slug: "octavia",
  title: "Octavia",
  summary: "Fixture public post summary",
  thumbnail: "/octavia-fixture.png",
  status: ["Public"],
  type: ["Post"],
  date: { start_date: "2026-10-12" },
  createdTime: "2026-10-12",
  fullWidth: false,
}
const idToSlug = buildIdToSlug([post])

function recordMap(title: Decoration[], wrapped = false): ExtendedRecordMap {
  const source: TextBlock = {
    id: sourceId,
    type: "text",
    parent_id: rootId,
    parent_table: "block",
    version: 1,
    created_time: 0,
    last_edited_time: 0,
    alive: true,
    created_by_table: "notion_user",
    created_by_id: "author",
    last_edited_by_table: "notion_user",
    last_edited_by_id: "author",
    properties: { title },
  }
  const boxed = { role: "reader", value: source }
  return {
    block: {
      [rootId]: { role: "reader", value: { ...source, id: rootId, type: "page", content: [sourceId], permissions: [] } },
      [sourceId]: wrapped ? { role: "reader", value: boxed } : boxed,
      [targetId]: { role: "reader", value: { ...source, id: targetId, type: "page", parent_id: "", properties: { title: [[post.title]] }, permissions: [] } },
    },
    collection: {},
    collection_view: {},
    collection_query: {},
    notion_user: {},
    signed_urls: {},
  } as ExtendedRecordMap
}

it.each([false, true])("promotes the real standalone p+a shape, preserving source anchors and root (wrapped=%s)", wrapped => {
  const title: Decoration[] = [["OpenStack Octavia로 Kolla Ansible을 이용한 로드밸런서 설정 가이드", [["p", targetId], ["a", href]]], [" "]]
  const original = recordMap(title, wrapped)
  const normalized = normalizeStandalonePageLinks(original, [post], idToSlug)
  const source = unwrapBlock(normalized.recordMap!.block[sourceId])!

  expect(source.type).toBe("page")
  expect(source.id).toBe(sourceId)
  expect(source.properties?.title).toEqual([[post.title]])
  expect(normalized.targets.get(normalizeNotionId(sourceId))).toBe(normalizeNotionId(targetId))
  expect(normalized.recordMap!.block[rootId]).toBe(original.block[rootId])
  expect(normalized.recordMap!.block[targetId]).toBe(original.block[targetId])
  expect(unwrapBlock(original.block[sourceId])?.properties?.title).toEqual(title)

  const PageLink = createPreviewPageLink([post], idToSlug, normalized.targets)
  const container = document.createElement("div")
  container.innerHTML = renderToStaticMarkup(
    <PageLink className={`notion-page-link notion-block-${normalizeNotionId(source.id)}`} href="/octavia">
      <a href={href}><a href={href}>Old p+a nested anchors</a></a>
    </PageLink>,
  )
  const card = container.querySelector(".notion-page-preview")!
  expect(card).toHaveAccessibleName("Octavia")
  expect(card.getAttribute("href")).toBe("/octavia")
  expect(card.classList.contains(`notion-block-${normalizeNotionId(sourceId)}`)).toBe(true)
  expect(card.textContent).toContain(post.summary)
  expect(card.querySelector("img")).not.toBeNull()
  expect(container.querySelectorAll("a")).toHaveLength(1)
  expect(container.textContent).not.toContain("Old p+a nested anchors")
})

const wholeTextCases: Decoration[][] = [
  [["Octavia", [["a", href]]]],
  [["‣", [["p", targetId]]]],
  [["‣", [["‣", ["p", targetId]]]]],
  [["  "], ["Octavia", [["a", "/octavia"]]], ["\n"]],
]

it.each(wholeTextCases.map(title => ({ title })))("recognizes a whole-text internal link without requiring both annotations: %j", ({ title }) => {
  const normalized = normalizeStandalonePageLinks(recordMap(title), [post], idToSlug)
  expect(unwrapBlock(normalized.recordMap!.block[sourceId])?.type).toBe("page")
})

const inlineAndFallbackCases: Decoration[][] = [
  [["See "], ["‣", [["p", targetId], ["a", href]]]],
  [["‣", [["p", targetId]]], [" for instructions."]],
  [["External", [["a", "https://example.com/"]]]],
  [["Unknown", [["p", "33333333-3333-4333-8333-333333333333"]]]],
  [["Conflicting", [["p", targetId], ["a", "https://example.com/"]]]],
]

it.each(inlineAndFallbackCases.map(title => ({ title })))("preserves prose, unknown and external links unchanged: %j", ({ title }) => {
  const original = recordMap(title)
  const normalized = normalizeStandalonePageLinks(original, [post], idToSlug)
  expect(normalized.recordMap).toBe(original)
  expect(normalized.targets.size).toBe(0)
})

it.each(["Private", "PublicOnDetail"] as const)("does not promote whole-text links to %s posts", status => {
  const original = recordMap([["‣", [["p", targetId], ["a", href]]]])
  const normalized = normalizeStandalonePageLinks(original, [{ ...post, status: [status] }], idToSlug)
  expect(normalized.recordMap).toBe(original)
  expect(normalized.targets.size).toBe(0)
})
