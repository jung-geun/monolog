type FileIconProps = { name: string; folder?: boolean; expanded?: boolean; size?: number }

/** Material Icon Theme 5.39.0; original MIT assets and attribution in public/icons/material. */
export default function FileIcon({ name, folder = false, expanded = false, size = 16 }: FileIconProps) {
  const filename = name.toLowerCase()
  const extension = filename.split(".").pop()
  const icon = folder
    ? `folder-${filename === "projects" ? "project" : "base"}${expanded ? "-open" : ""}`
    : extension === "md" || extension === "mdx" ? "markdown"
    : extension === "json" ? "json"
    : extension === "yaml" || extension === "yml" ? "yaml"
    : extension === "xml" || extension === "rss" ? "xml"
    : "document"
  // Tiny local SVGs need no image optimization or remote request.
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={`/icons/material/${icon}.svg`} alt="" aria-hidden="true" width={size} height={size} draggable={false} style={{ flexShrink: 0, verticalAlign: "middle" }} />
}
