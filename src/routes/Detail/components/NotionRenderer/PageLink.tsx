import Image from "next/image"
import Link from "next/link"
import type { AnchorHTMLAttributes } from "react"
import type { TPost } from "src/types"
import { normalizeNotionId } from "src/libs/utils/notion/rewriteInternalLinks"

type PageLinkProps = AnchorHTMLAttributes<HTMLAnchorElement>

/**
 * RNX's PageLink slot also renders mentions, breadcrumbs and search results.
 * Only standalone pages carry a notion-block-{id} class; aliases carry their
 * target UUID instead. Neither shape is used for inline rich-text links.
 */
export function createPreviewPageLink(
  posts: readonly TPost[],
  idToSlug: ReadonlyMap<string, string>,
  standaloneTargets?: ReadonlyMap<string, string>,
) {
  const publicPosts = new Map<string, TPost>()
  for (const post of posts) {
    if (post.status.includes("Public") && post.slug) {
      publicPosts.set(normalizeNotionId(post.id), post)
    }
  }
  return function PreviewPageLink({ className, href, children, ...props }: PageLinkProps) {
    const classes = className?.split(/\s+/) ?? []
    const targetId = classes.includes("notion-page-link")
      ? classes
        .map(token => normalizeNotionId(token.replace(/^notion-block-/, "")))
        .map(id => standaloneTargets?.get(id) ?? id)
        .find(id => /^[0-9a-f]{32}$/.test(id) && publicPosts.has(id))
      : undefined
    const post = targetId ? publicPosts.get(targetId) : undefined
    const slug = targetId ? idToSlug.get(targetId) : undefined

    // Preserve RNX's default <a> and children for mentions and unknown/private
    // targets, rather than changing their title, semantics or destination.
    if (!post || !slug || href !== `/${slug}`) {
      return <a {...props} className={className} href={href}>{children}</a>
    }

    // Replace (do not wrap) RNX's PageTitle children: rich-text titles can
    // contain links of their own. The card must have exactly one anchor.
    return (
      <Link
        {...props}
        href={`/${slug}`}
        className={[...classes.filter(token => token !== "notion-page-link"), "notion-bookmark", "notion-page-preview"].join(" ")}
        aria-label={post.title}
      >
        <div>
          <div className="notion-bookmark-title">{post.title}</div>
          {post.summary && <div className="notion-bookmark-description">{post.summary}</div>}
          <div className="notion-bookmark-link">
            <div className="notion-bookmark-link-text">/{slug}</div>
          </div>
        </div>
        {post.thumbnail && (
          <div className="notion-bookmark-image">
            <Image src={post.thumbnail} alt="" fill sizes="(max-width: 640px) 100vw, 180px" />
          </div>
        )}
      </Link>
    )
  }
}
