export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return
  if (process.env.NEXT_PHASE === "phase-production-build") return
  if (process.env.NEXT_GRAPH_WARM === "0") return

  // Defer so the server can start accepting requests before the graph build begins.
  // Graph build can take up to 25s on large workspaces; we don't want to block startup.
  setTimeout(async () => {
    try {
      const { getNotionGraph } = await import("./src/apis/notion-client/getNotionGraph")
      const t0 = Date.now()
      const graph = await getNotionGraph()
      console.log(
        `[instrumentation] graph warmed in ${Date.now() - t0}ms` +
          ` (nodes=${graph.nodes.length}, edges=${graph.edges.length}` +
          `${graph.partial ? ", partial" : ""})`
      )
    } catch (err) {
      console.error("[instrumentation] graph warm failed:", err)
    }
  }, 500)
}
