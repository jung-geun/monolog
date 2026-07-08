import type { BuiltGraph } from "src/apis/notion-client/getBuiltGraph"
import type { NotionGraph } from "src/types/notionGraph"
import { warnLog } from "src/libs/utils/logger"
import { getQdrantClient } from "./qdrantClient"

export const GRAPH_SNAPSHOT_COLLECTION = "post_graph_snapshots"
export const GRAPH_SNAPSHOT_POINT_ID = "00000000-0000-4000-8000-000000000001"
export const GRAPH_SNAPSHOT_SCHEMA_VERSION = "v1"

export type GraphSnapshotPayload = {
  kind: "notion-graph-snapshot"
  schemaVersion: typeof GRAPH_SNAPSHOT_SCHEMA_VERSION
  graphHash: string
  generatedAt: string
  postCount: number
  edgeCount: number
  notionGraph: NotionGraph
  builtGraph: BuiltGraph
}

export type GraphSnapshot = {
  graphHash: string
  notionGraph: NotionGraph
  builtGraph: BuiltGraph
}

function isGraphSnapshotStoreEnabled(): boolean {
  return Boolean(process.env.QDRANT_URL)
}

async function ensureGraphSnapshotCollection(): Promise<void> {
  const client = getQdrantClient()
  const { collections } = await client.getCollections()
  if (collections.some((collection) => collection.name === GRAPH_SNAPSHOT_COLLECTION)) return

  await client.createCollection(GRAPH_SNAPSHOT_COLLECTION, {
    vectors: { size: 1, distance: "Dot" },
    on_disk_payload: true,
    timeout: 5,
  })
}

export async function getGraphSnapshot(graphHash: string): Promise<GraphSnapshot | null> {
  if (!isGraphSnapshotStoreEnabled()) return null

  try {
    const client = getQdrantClient()
    const points = await client.retrieve(GRAPH_SNAPSHOT_COLLECTION, {
      ids: [GRAPH_SNAPSHOT_POINT_ID],
      with_payload: true,
      with_vector: false,
      timeout: 3,
    })
    const payload = points[0]?.payload as GraphSnapshotPayload | undefined

    if (!payload) {
      warnLog("[qdrantGraphStore] graph snapshot point missing")
      return null
    }
    if (payload.kind !== "notion-graph-snapshot") {
      warnLog("[qdrantGraphStore] graph snapshot kind mismatch", payload.kind)
      return null
    }
    if (payload.schemaVersion !== GRAPH_SNAPSHOT_SCHEMA_VERSION) {
      warnLog("[qdrantGraphStore] graph snapshot schema mismatch", payload.schemaVersion)
      return null
    }
    if (payload.graphHash !== graphHash) {
      warnLog("[qdrantGraphStore] graph snapshot hash mismatch", payload.graphHash)
      return null
    }

    return {
      graphHash,
      notionGraph: payload.notionGraph,
      builtGraph: payload.builtGraph,
    }
  } catch (err) {
    warnLog("[qdrantGraphStore] failed to read graph snapshot:", err)
    return null
  }
}

export async function upsertGraphSnapshot(
  graphHash: string,
  notionGraph: NotionGraph,
  builtGraph: BuiltGraph
): Promise<void> {
  if (!isGraphSnapshotStoreEnabled()) return

  await ensureGraphSnapshotCollection()

  const payload: GraphSnapshotPayload = {
    kind: "notion-graph-snapshot",
    schemaVersion: GRAPH_SNAPSHOT_SCHEMA_VERSION,
    graphHash,
    generatedAt: builtGraph.generatedAt,
    postCount: notionGraph.nodes.filter((node) => node.kind === "post").length,
    edgeCount: notionGraph.edges.length,
    notionGraph,
    builtGraph,
  }

  const client = getQdrantClient()
  await client.upsert(GRAPH_SNAPSHOT_COLLECTION, {
    wait: true,
    timeout: 10,
    points: [{ id: GRAPH_SNAPSHOT_POINT_ID, vector: [1], payload }],
  })
}
