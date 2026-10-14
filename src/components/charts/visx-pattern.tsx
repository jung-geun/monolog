/**
 * Bklit UI — https://github.com/bklit/bklit-ui (private source package 0.0.0).
 * MIT, Copyright (c) 2026 uixmat; see /src/components/charts/LICENSE.
 * Registry: https://ui.bklit.com/r/background.json
 * Upstream path: src/charts/visx-pattern.tsx
 * Original source SHA-256: 5b1a1246f807db20e47a5d8cd9dddb439cb619eb73b8a7e94a4244ae2b5b833c
 * Adaptation: heatmap-only extraction; unrelated chart contexts/patterns omitted.
 */
"use client";

// Heatmaps only transitively use these two upstream pattern primitives.
export { Circles as PatternCircles } from "./patterns/circles";
export { Lines as PatternLines } from "./patterns/lines";
