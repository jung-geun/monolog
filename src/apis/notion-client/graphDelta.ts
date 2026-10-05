import type { GraphDelta } from "src/libs/content/types"
import { getPosts } from "./getPosts"
import { refreshIncrementalGraph } from "./incrementalGraph"

// A delta holds only changed posts; incremental diffs need the full committed public set,
// otherwise every unchanged post would look removed.
export async function applyGraphDelta(delta: GraphDelta): Promise<void> {
  await refreshIncrementalGraph({
    posts: await getPosts(),
    changedIds: delta.upserted.map((post) => post.id),
    removedIds: delta.deletedIds,
  })
}
