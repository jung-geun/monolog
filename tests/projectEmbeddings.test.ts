/** @jest-environment node */
import { projectEmbeddings } from "src/apis/vector/projectEmbeddings"

const distance = (a: number[], b: number[]) => Math.hypot(...a.map((value, i) => value - b[i]))

describe("document-vector spatial projection", () => {
  it("preserves relative document distances when the corpus fits in three components", () => {
    const vectors = [[1, 0, 0, 1], [0.99, 0.01, 0, 1], [0, 1, 0, 1], [0, 0, 1, 1]]
    const projected = projectEmbeddings(vectors)
    const scale = distance(projected[0], projected[2]) / distance(vectors[0], vectors[2])
    for (let a = 0; a < vectors.length; a++) {
      for (let b = a + 1; b < vectors.length; b++) {
        expect(distance(projected[a], projected[b])).toBeCloseTo(distance(vectors[a], vectors[b]) * scale, 5)
      }
    }
  })

  it("keeps identical documents co-located without NaNs for a zero-rank corpus", () => {
    expect(projectEmbeddings([[1, 2, 3], [1, 2, 3]])).toEqual([[0, 0, 0], [0, 0, 0]])
  })

  it("keeps a collinear corpus collinear and ordered instead of inventing depth", () => {
    const projected = projectEmbeddings([[0, 0, 0], [1, 2, 3], [2, 4, 6]])
    expect(distance(projected[0], projected[1])).toBeCloseTo(distance(projected[1], projected[2]), 6)
    expect(distance(projected[0], projected[2])).toBeCloseTo(2 * distance(projected[0], projected[1]), 6)
  })
})
