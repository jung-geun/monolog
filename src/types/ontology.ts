export type EntityKind = "concept" | "person" | "tech" | "work"

export type Entity = {
  id: string
  kind: EntityKind
  name: string
  aliases: string[]
  description?: string
  postIds: string[]
}

export type SemanticRelationKind =
  | "elaborates"
  | "contradicts"
  | "supports"
  | "prerequisite"
  | "applies"
  | "similar-topic"

export type SemanticEdge = {
  source: string
  target: string
  kind: SemanticRelationKind
  confidence: number
  rationale?: string
}

export type PostOntology = {
  postId: string
  summary: string
  entities: Omit<Entity, "id" | "postIds">[]
}

export type Ontology = {
  version: string
  generatedAt: string
  entities: Entity[]
  edges: SemanticEdge[]
}

export type OntologyState = Ontology & {
  index: Record<string, string> // postId → lastEditedTime
}
