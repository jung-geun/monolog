export type EdgeKind = "relation" | "mention" | "link"

export type RawEdge = {
  source: string
  target: string
  type: EdgeKind
  context?: string
}

export type NotionGraphNode = {
  id: string
  slug: string
  title: string
  category: string
  tags: string[]
  icon?: string
  url?: string
}

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
}
