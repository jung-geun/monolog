/**
 * Three principal components of centred document vectors. Matrix-free power
 * iteration applies XᵀX without allocating a dimensions² covariance matrix.
 * Distances here are a 3D approximation; retrieval always uses all 768 dimensions.
 */
export function projectEmbeddings(vectors: number[][]): [number, number, number][] {
  if (!vectors.length) return []
  const dimensions = vectors[0].length
  const mean = new Float64Array(dimensions)
  for (const vector of vectors) {
    for (let d = 0; d < dimensions; d++) mean[d] += vector[d] / vectors.length
  }
  const centred = vectors.map(vector => Float64Array.from(vector, (value, d) => value - mean[d]))
  const basis: Float64Array[] = []
  const scores = new Float64Array(vectors.length)
  let current = new Float64Array(dimensions)
  let next = new Float64Array(dimensions)
  const orthonormalize = (vector: Float64Array): number => {
    // A second pass keeps nearly degenerate components orthogonal.
    for (let pass = 0; pass < 2; pass++) {
      for (const previous of basis) {
        let dot = 0
        for (let d = 0; d < dimensions; d++) dot += vector[d] * previous[d]
        for (let d = 0; d < dimensions; d++) vector[d] -= dot * previous[d]
      }
    }
    let norm = 0
    for (let d = 0; d < dimensions; d++) norm += vector[d] * vector[d]
    norm = Math.sqrt(norm)
    if (norm > 1e-12) for (let d = 0; d < dimensions; d++) vector[d] /= norm
    return norm
  }
  for (let axis = 0; axis < 3; axis++) {
    for (let d = 0; d < dimensions; d++) current[d] = Math.sin((d + 1) * (axis + 1) * 1.61803398875)
    orthonormalize(current)
    for (let iteration = 0; iteration < 80; iteration++) {
      next.fill(0)
      for (let row = 0; row < centred.length; row++) {
        let dot = 0
        for (let d = 0; d < dimensions; d++) dot += centred[row][d] * current[d]
        scores[row] = dot
      }
      for (let row = 0; row < centred.length; row++) {
        for (let d = 0; d < dimensions; d++) next[d] += centred[row][d] * scores[row]
      }
      if (orthonormalize(next) <= 1e-12) { current.fill(0); break }
      let alignment = 0
      for (let d = 0; d < dimensions; d++) alignment += current[d] * next[d]
      const old = current
      current = next
      next = old
      if (1 - Math.abs(alignment) < 1e-8) break
    }
    let dominant = 0
    for (let d = 1; d < dimensions; d++) if (Math.abs(current[d]) > Math.abs(current[dominant])) dominant = d
    if (current[dominant] < 0) for (let d = 0; d < dimensions; d++) current[d] *= -1
    basis.push(current.slice())
  }
  const positions = centred.map(vector => {
    const position: [number, number, number] = [0, 0, 0]
    for (let axis = 0; axis < 3; axis++) {
      for (let d = 0; d < dimensions; d++) position[axis] += vector[d] * basis[axis][d]
    }
    return position
  })
  let radius = 0
  for (const position of positions) radius = Math.max(radius, Math.hypot(...position))
  if (radius > 1e-12) for (const position of positions) for (let axis = 0; axis < 3; axis++) position[axis] /= radius
  return positions
}
