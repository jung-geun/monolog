import type { BuiltGraph } from "src/apis/notion-client/getBuiltGraph"

// Added at response time; never persisted into the relationship graph snapshot.
export type GraphWithEmbeddings = BuiltGraph & {
  embedding?: {
    model: string
    projection: "PCA-3D"
    embedded: number
    total: number
    searchAvailable: boolean
    pending: boolean
    similarities: { source: string; target: string; score: number }[]
  }
}
