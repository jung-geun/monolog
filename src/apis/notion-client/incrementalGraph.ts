import type { TPosts } from "src/types"
import { getOrBuildOntology } from "src/apis/ontology/getOntology"
import { warnLog } from "src/libs/utils/logger"
import { computePostsGraphHash, eligibleGraphPosts } from "./graphHash"
import { refreshGraphSnapshotInQdrant, pruneGraphSnapshotInQdrant } from "./graphSnapshot"
import { getGraphSnapshot } from "src/apis/vector/qdrantGraphStore"
import { isEmbeddingConfigured } from "src/apis/llm/embeddingGemma"

export type IncrementalGraphRefreshInput = {
  posts: TPosts
  changedIds: string[]
  removedIds: string[]
}

let maintenanceQueue: Promise<void> = Promise.resolve()
let completedGraphHash: string | null = null

// Serial commits prevent overlapping maintenance from persisting an older
// snapshot; callers await both graph extraction and configured AI maintenance.
export function refreshIncrementalGraph(input: IncrementalGraphRefreshInput): Promise<void> {
  const captured = structuredClone(input)
  const work = maintenanceQueue.then(async () => {
    const posts = eligibleGraphPosts(captured.posts)
    let graphError: unknown = null
    try {
      const hash = computePostsGraphHash(posts)
      const snapshot = await getGraphSnapshot()
      if (completedGraphHash !== hash && snapshot?.graphHash !== hash) {
        await pruneGraphSnapshotInQdrant(posts)
        const result = await refreshGraphSnapshotInQdrant({ posts })
        if (result.needsRetry) throw new Error("Incremental graph extraction or snapshot persistence failed")
        completedGraphHash = hash
      }
    } catch (err) {
      graphError = err
    }
    // The durable content outbox remains pending until AI work has finished;
    // serverless runtimes must not rely on work detached after the response.
    if (process.env.ANTHROPIC_API_KEY && isEmbeddingConfigured()) {
      await getOrBuildOntology({ posts, changedIds: captured.changedIds, removedIds: captured.removedIds })
    }
    if (graphError) throw graphError
  })
  maintenanceQueue = work.then(() => undefined, () => undefined)
  return work
}
