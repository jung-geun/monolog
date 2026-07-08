export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return
  if (process.env.NEXT_PHASE === "phase-production-build") return
  if (process.env.NEXT_GRAPH_WARM === "0") return

  // Defer so the server can start accepting requests before the graph build begins.
  // Graph build can take up to 25s on large workspaces; we don't want to block startup.
  setTimeout(async () => {
    try {
      // Dynamic import required: this file is loaded in non-Node/build contexts where graphSnapshot's Node-only dependencies must stay behind the runtime guards.
      const { refreshGraphSnapshotInQdrant } = await import("./src/apis/notion-client/graphSnapshot")
      const t0 = Date.now()
      const { builtGraph } = await refreshGraphSnapshotInQdrant()
      console.log(
        `[instrumentation] graph warmed in ${Date.now() - t0}ms` +
          ` (nodes=${builtGraph.nodes.length}, edges=${builtGraph.edges.length}, generatedAt=${builtGraph.generatedAt})`
      )
    } catch (err) {
      console.error("[instrumentation] graph warm failed:", err)
    }
  }, 500)
}
