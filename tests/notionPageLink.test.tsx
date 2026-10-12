import { act } from "react"
import { hydrateRoot, type Root } from "react-dom/client"
import { renderToStaticMarkup, renderToString } from "react-dom/server"
import { createPreviewPageLink } from "src/routes/Detail/components/NotionRenderer/PageLink"
import { buildIdToSlug } from "src/libs/utils/notion/rewriteInternalLinks"
import type { TPost } from "src/types"

;(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true

const targetId = "22222222-2222-4222-8222-222222222222"
const compactId = targetId.replace(/-/g, "")
const post: TPost = {
  id: targetId,
  slug: "preview-target",
  title: "Preview target title",
  summary: "A public post summary supplied by the existing publication cache.",
  thumbnail: "/preview-target.png",
  status: ["Public"],
  type: ["Post"],
  date: { start_date: "2026-10-12" },
  createdTime: "2026-10-12",
  fullWidth: false,
}

function markupContainer(markup: string) {
  const container = document.createElement("div")
  container.innerHTML = markup
  return container
}

it.each([
  ["child page", `notion-page-link notion-block-${compactId}`],
  ["link-to-page alias", `notion-page-link ${targetId}`],
])("renders a %s as a synchronous accessible public-post card", (_kind, className) => {
  const PageLink = createPreviewPageLink([post], buildIdToSlug([post]))
  const container = markupContainer(renderToStaticMarkup(
    <PageLink href="/preview-target" className={className}>
      <span>Notion title with <a href="https://example.com/">an embedded link</a></span>
    </PageLink>,
  ))
  const card = container.querySelector<HTMLAnchorElement>(".notion-page-preview")!

  expect(card).not.toBeNull()
  expect(card.getAttribute("href")).toBe("/preview-target")
  expect(card).toHaveAccessibleName(post.title)
  expect(card.querySelector(".notion-bookmark-title")?.textContent).toBe(post.title)
  expect(card.querySelector(".notion-bookmark-description")?.textContent).toBe(post.summary)
  expect(card.querySelector<HTMLImageElement>("img")?.getAttribute("alt")).toBe("")
  expect(card.querySelector<HTMLImageElement>("img")?.getAttribute("src")).toContain("preview-target.png")
  expect(card.getAttribute("target")).toBeNull()
  expect(card.textContent).not.toContain("Notion title with")
  expect(container.querySelectorAll("a")).toHaveLength(1)
})

it("keeps inline mentions, inline links and non-block page links inline", () => {
  const PageLink = createPreviewPageLink([post], buildIdToSlug([post]))
  for (const className of ["notion-link", "breadcrumb", "result notion-page-link", "notion-page-link"]) {
    const container = markupContainer(renderToStaticMarkup(
      <PageLink href="/preview-target" className={className}>
        <span className="notion-page-title">Original inline mention</span>
      </PageLink>,
    ))
    expect(container.querySelector(".notion-page-preview")).toBeNull()
    expect(container.querySelector("a")?.getAttribute("href")).toBe("/preview-target")
    expect(container.querySelector(".notion-page-title")?.textContent).toBe("Original inline mention")
    expect(container.textContent).not.toContain(post.summary)
  }
})

it.each(["Private", "PublicOnDetail"] as const)("does not expose %s metadata in a card", status => {
  const privatePost: TPost = { ...post, status: [status] }
  const PageLink = createPreviewPageLink([privatePost], buildIdToSlug([privatePost]))
  const container = markupContainer(renderToStaticMarkup(
    <PageLink href="/preview-target" className={`notion-page-link notion-block-${compactId}`}>
      Original fallback title
    </PageLink>,
  ))

  expect(container.querySelector(".notion-page-preview")).toBeNull()
  expect(container.querySelector("a")?.textContent).toBe("Original fallback title")
  expect(container.querySelector("img")).toBeNull()
  expect(container.textContent).not.toContain(post.summary)
})

it("preserves unknown or external targets and their existing anchor attributes", () => {
  const PageLink = createPreviewPageLink([post], buildIdToSlug([post]))
  for (const [href, blockId] of [
    ["https://www.notion.so/33333333333343338333333333333333", "33333333333343338333333333333333"],
    ["https://example.com/preview-target", compactId],
  ]) {
    const container = markupContainer(renderToStaticMarkup(
      <PageLink href={href} className={`notion-page-link notion-block-${blockId}`} target="_blank" rel="noopener">
        Existing fallback title
      </PageLink>,
    ))
    const anchor = container.querySelector("a")!
    expect(anchor.getAttribute("href")).toBe(href)
    expect(anchor.getAttribute("target")).toBe("_blank")
    expect(anchor.getAttribute("rel")).toBe("noopener")
    expect(anchor.textContent).toBe("Existing fallback title")
    expect(container.querySelector(".notion-page-preview")).toBeNull()
  }
})

it("renders title-only metadata without empty thumbnail or summary placeholders", () => {
  const titleOnlyPost: TPost = { ...post, summary: undefined, thumbnail: undefined }
  const PageLink = createPreviewPageLink([titleOnlyPost], buildIdToSlug([titleOnlyPost]))
  const container = markupContainer(renderToStaticMarkup(
    <PageLink href="/preview-target" className={`notion-page-link ${targetId}`}>Fallback title</PageLink>,
  ))

  expect(container.querySelector(".notion-page-preview")).toHaveAccessibleName(post.title)
  expect(container.querySelector(".notion-bookmark-description")).toBeNull()
  expect(container.querySelector(".notion-bookmark-image")).toBeNull()
  expect(container.querySelector("img")).toBeNull()
})

it("hydrates the server-rendered card without losing its metadata or destination", async () => {
  const PageLink = createPreviewPageLink([post], buildIdToSlug([post]))
  const element = <PageLink href="/preview-target" className={`notion-page-link notion-block-${compactId}`}>Fallback title</PageLink>
  const container = markupContainer(renderToString(element))
  document.body.appendChild(container)
  const onRecoverableError = jest.fn()
  let root: Root | undefined
  try {
    await act(async () => { root = hydrateRoot(container, element, { onRecoverableError }) })
    expect(onRecoverableError).not.toHaveBeenCalled()
    expect(container.querySelector(".notion-page-preview")).toHaveAccessibleName(post.title)
    expect(container.querySelector(".notion-bookmark-description")?.textContent).toBe(post.summary)
    expect(container.querySelector("a")?.getAttribute("href")).toBe("/preview-target")
    expect(container.querySelectorAll("a")).toHaveLength(1)
  } finally {
    act(() => root?.unmount())
    container.remove()
  }
})
