/**
 * Bklit UI — https://github.com/bklit/bklit-ui (private source package 0.0.0).
 * MIT, Copyright (c) 2026 uixmat; see /src/components/charts/LICENSE.
 * Registry: https://ui.bklit.com/r/chart-context.json
 * Upstream path: src/charts/chart-context.tsx
 * Original source SHA-256: 890e9f473dd105ed3bea286b6a668eadd8540641972acb902885e3f973264f65
 * Adaptation: heatmap-only extraction; unrelated chart contexts/patterns omitted.
 */
export interface Margin {
  top: number;
  right: number;
  bottom: number;
  left: number;
}

// Heatmap-only subset of upstream chart-context; no line/scatter contexts.
export const chartCssVars = { tooltipBackground: "var(--chart-tooltip-background)" };
