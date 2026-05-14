export type EdgeKind =
  | "mention"
  | "link"
  | "link_to_page"
  | "has-tag"
  | "in-series"
  | "series-next"

export type RawEdge = {
  source: string
  target: string
  type: EdgeKind
  context?: string
}

export type PostNode = {
  kind: "post"
  id: string
  slug: string
  title: string
  category: string
  tags: string[]
  readTime: number
  icon?: string
  url?: string
}

export type TagNode = {
  kind: "tag"
  id: string
  title: string
}

export type SeriesNode = {
  kind: "series"
  id: string
  title: string
}

export type NotionGraphNode = PostNode | TagNode | SeriesNode

export type NotionGraphEdge = {
  source: string
  target: string
  type: EdgeKind
  weight: number
  contexts?: string[]
}

export type NotionGraph = {
  version: string
  generatedAt: string
  nodes: NotionGraphNode[]
  edges: NotionGraphEdge[]
  partial?: boolean
}
